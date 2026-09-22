package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.PasswordResetToken;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.PasswordResetTokenRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end verification of the Forgot Password -> email token -> Reset
 * Password flow, independent of actual Resend delivery (which this test
 * environment has no credentials/inbox for). Exercises the real
 * PasswordResetService/PasswordResetTokenRepository against H2, manipulating
 * token rows directly the same way a real elapsed-time or replay scenario
 * would leave them, so token expiry/reuse/malformed-token handling is
 * verified empirically rather than only by reading the source.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PasswordResetFlowTest {

    private static final String PASSWORD = "original-password";

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordResetTokenRepository passwordResetTokenRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private Role employeeRole() {
        return roleRepository.findByName("EMPLOYEE").orElseGet(() -> {
            Role role = new Role();
            role.setName("EMPLOYEE");
            return roleRepository.save(role);
        });
    }

    private User user(String email) {
        User u = new User();
        u.setFullName("Password Reset Flow Test User");
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode(PASSWORD));
        u.getRoles().add(employeeRole());
        return userRepository.save(u);
    }

    private String login(String email, String password) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginBody(email, password));
        return mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andReturn().getResponse().getStatus() == 200 ? "OK" : "FAIL";
    }

    private void forgotPassword(String email) throws Exception {
        mockMvc.perform(post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\"}"))
            .andExpect(status().isOk());
    }

    private void confirmReset(String token, String newPassword, int expectedStatus) throws Exception {
        mockMvc.perform(post("/api/auth/forgot-password/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\",\"newPassword\":\"" + newPassword + "\"}"))
            .andExpect(status().is(expectedStatus));
    }

    // --- AC-05 / AC-06 (token creation side of Resend delivery) -----------

    @Test
    @Transactional
    void forgotPasswordForRegisteredEmailCreatesExactlyOneUsableToken() throws Exception {
        user("reset-flow-registered@nforce.test");
        long before = passwordResetTokenRepository.count();

        forgotPassword("reset-flow-registered@nforce.test");

        assertThat(passwordResetTokenRepository.count()).isEqualTo(before + 1);
    }

    // --- AC-08: account enumeration ----------------------------------------

    @Test
    @Transactional
    void forgotPasswordForUnregisteredEmailCreatesNoTokenAndReturnsTheSame200AsRegistered() throws Exception {
        user("reset-flow-enum-registered@nforce.test");
        long before = passwordResetTokenRepository.count();

        String registeredBody = "{\"email\":\"reset-flow-enum-registered@nforce.test\"}";
        String unregisteredBody = "{\"email\":\"reset-flow-enum-unregistered@nforce.test\"}";

        var registeredResult = mockMvc.perform(post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON).content(registeredBody))
            .andExpect(status().isOk())
            .andReturn().getResponse();

        var unregisteredResult = mockMvc.perform(post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON).content(unregisteredBody))
            .andExpect(status().isOk())
            .andReturn().getResponse();

        // Identical status AND identical (empty) body for both -- nothing in
        // the HTTP response lets a caller distinguish "exists" from "doesn't".
        assertThat(registeredResult.getStatus()).isEqualTo(unregisteredResult.getStatus());
        assertThat(registeredResult.getContentAsString()).isEqualTo(unregisteredResult.getContentAsString());

        // Only the registered email actually got a token row.
        assertThat(passwordResetTokenRepository.count()).isEqualTo(before + 1);
    }

    // --- AC-07: valid token completes the reset, old password stops working ---

    @Test
    @Transactional
    void validTokenResetsThePasswordAndOldPasswordNoLongerWorks() throws Exception {
        user("reset-flow-valid@nforce.test");
        forgotPassword("reset-flow-valid@nforce.test");
        PasswordResetToken token = passwordResetTokenRepository
            .findAll().stream()
            .filter(t -> "reset-flow-valid@nforce.test".equals(t.getEmail()))
            .findFirst().orElseThrow();

        confirmReset(token.getToken().toString(), "brand-new-password", 200);

        assertThat(login("reset-flow-valid@nforce.test", PASSWORD)).isEqualTo("FAIL");
        assertThat(login("reset-flow-valid@nforce.test", "brand-new-password")).isEqualTo("OK");
    }

    // --- Step 11: reused token must not work a second time -----------------

    @Test
    @Transactional
    void usedTokenCannotBeReusedAndPasswordIsNotChangedAgain() throws Exception {
        user("reset-flow-reuse@nforce.test");
        forgotPassword("reset-flow-reuse@nforce.test");
        PasswordResetToken token = passwordResetTokenRepository
            .findAll().stream()
            .filter(t -> "reset-flow-reuse@nforce.test".equals(t.getEmail()))
            .findFirst().orElseThrow();
        String tokenStr = token.getToken().toString();

        confirmReset(tokenStr, "first-new-password", 200);
        // Second attempt with the SAME token, a different target password --
        // must be rejected, and must NOT overwrite the password set above.
        confirmReset(tokenStr, "second-new-password", 400);

        assertThat(login("reset-flow-reuse@nforce.test", "first-new-password")).isEqualTo("OK");
        assertThat(login("reset-flow-reuse@nforce.test", "second-new-password")).isEqualTo("FAIL");
    }

    // --- Step 10: expired token must be rejected ----------------------------

    @Test
    @Transactional
    void expiredTokenIsRejectedAndPasswordIsNotChanged() throws Exception {
        user("reset-flow-expired@nforce.test");
        forgotPassword("reset-flow-expired@nforce.test");
        PasswordResetToken token = passwordResetTokenRepository
            .findAll().stream()
            .filter(t -> "reset-flow-expired@nforce.test".equals(t.getEmail()))
            .findFirst().orElseThrow();

        // Simulate the 1-hour expiry having already passed.
        token.setUsedAt(null);
        var expiredField = PasswordResetToken.class.getDeclaredField("expiresAt");
        expiredField.setAccessible(true);
        expiredField.set(token, OffsetDateTime.now().minusMinutes(1));
        passwordResetTokenRepository.save(token);

        confirmReset(token.getToken().toString(), "should-not-apply", 400);

        assertThat(login("reset-flow-expired@nforce.test", PASSWORD)).isEqualTo("OK");
        assertThat(login("reset-flow-expired@nforce.test", "should-not-apply")).isEqualTo("FAIL");
    }

    // --- Step 9: invalid / modified / malformed tokens ----------------------

    @Test
    @Transactional
    void malformedNonUuidTokenIsRejectedWithoutChangingAnyPassword() throws Exception {
        user("reset-flow-malformed@nforce.test");

        confirmReset("this-is-not-a-uuid", "irrelevant-password", 400);

        assertThat(login("reset-flow-malformed@nforce.test", PASSWORD)).isEqualTo("OK");
    }

    @Test
    @Transactional
    void wellFormedButUnknownTokenIsRejected() throws Exception {
        confirmReset(UUID.randomUUID().toString(), "irrelevant-password", 400)
        ;
    }

    @Test
    void missingTokenFieldIsRejectedAsABadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/forgot-password/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"newPassword\":\"some-new-password\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void emptyTokenFieldIsRejectedAsABadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/forgot-password/confirm")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"\",\"newPassword\":\"some-new-password\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    @Transactional
    void newPasswordShorterThanEightCharsIsRejectedByBeanValidation() throws Exception {
        user("reset-flow-short-pw@nforce.test");
        forgotPassword("reset-flow-short-pw@nforce.test");
        PasswordResetToken token = passwordResetTokenRepository
            .findAll().stream()
            .filter(t -> "reset-flow-short-pw@nforce.test".equals(t.getEmail()))
            .findFirst().orElseThrow();

        confirmReset(token.getToken().toString(), "short1", 400);

        assertThat(login("reset-flow-short-pw@nforce.test", PASSWORD)).isEqualTo("OK");
    }

    private record LoginBody(String email, String password) {}
}
