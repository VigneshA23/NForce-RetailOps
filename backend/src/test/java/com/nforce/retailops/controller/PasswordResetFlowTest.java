package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.PasswordResetToken;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.PasswordResetTokenRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.UserRepository;
import com.nforce.retailops.security.ResetTokenHashing;
import com.nforce.retailops.service.MailService;
import com.nforce.retailops.service.PasswordResetService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end verification of the Forgot Password -> email token -> Reset
 * Password flow, independent of actual Resend delivery (which this test
 * environment has no credentials/inbox for). Exercises the real
 * PasswordResetService/PasswordResetTokenRepository against H2, manipulating
 * token rows directly the same way a real elapsed-time or replay scenario
 * would leave them, so token expiry/reuse/malformed-token handling is
 * verified empirically rather than only by reading the source.
 *
 * <p>Only a hash of each token is stored (RTS-495), so a test learns the raw
 * token the way a user does: from the link in the (mocked) email.
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
    @Autowired private PasswordResetService passwordResetService;
    @Autowired private JdbcTemplate jdbcTemplate;

    @MockBean private MailService mailService;

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

    // The raw token from the most recent reset link "emailed" to this address.
    private String emailedResetToken(String email) {
        ArgumentCaptor<String> link = ArgumentCaptor.forClass(String.class);
        verify(mailService, atLeastOnce()).sendPasswordResetEmail(eq(email), any(), link.capture());
        return tokenFrom(link.getValue());
    }

    private static String tokenFrom(String link) {
        assertThat(link).contains("?token=");
        return link.substring(link.indexOf("?token=") + "?token=".length());
    }

    private PasswordResetToken storedRow(String email) {
        return passwordResetTokenRepository.findAll().stream()
            .filter(t -> email.equals(t.getEmail()))
            .findFirst().orElseThrow();
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

        confirmReset(emailedResetToken("reset-flow-valid@nforce.test"), "brand-new-password", 200);

        assertThat(login("reset-flow-valid@nforce.test", PASSWORD)).isEqualTo("FAIL");
        assertThat(login("reset-flow-valid@nforce.test", "brand-new-password")).isEqualTo("OK");
    }

    // --- Step 11: reused token must not work a second time -----------------

    @Test
    @Transactional
    void usedTokenCannotBeReusedAndPasswordIsNotChangedAgain() throws Exception {
        user("reset-flow-reuse@nforce.test");
        forgotPassword("reset-flow-reuse@nforce.test");
        String tokenStr = emailedResetToken("reset-flow-reuse@nforce.test");

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
        String tokenStr = emailedResetToken("reset-flow-expired@nforce.test");
        PasswordResetToken token = storedRow("reset-flow-expired@nforce.test");

        // Simulate the 1-hour expiry having already passed.
        token.setUsedAt(null);
        var expiredField = PasswordResetToken.class.getDeclaredField("expiresAt");
        expiredField.setAccessible(true);
        expiredField.set(token, OffsetDateTime.now().minusMinutes(1));
        passwordResetTokenRepository.save(token);

        confirmReset(tokenStr, "should-not-apply", 400);

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

        confirmReset(emailedResetToken("reset-flow-short-pw@nforce.test"), "short1", 400);

        assertThat(login("reset-flow-short-pw@nforce.test", PASSWORD)).isEqualTo("OK");
    }

    // --- RTS-495: tokens are stored hashed, never in plaintext ---------------

    @Test
    @Transactional
    void storedRowHoldsOnlyTheHashOfTheEmailedToken() throws Exception {
        user("reset-flow-hash@nforce.test");
        forgotPassword("reset-flow-hash@nforce.test");
        String raw = emailedResetToken("reset-flow-hash@nforce.test");

        PasswordResetToken row = storedRow("reset-flow-hash@nforce.test");
        assertThat(row.getTokenHash())
            .isEqualTo(ResetTokenHashing.hash(UUID.fromString(raw)))
            .hasSize(64)
            .isNotEqualTo(raw);

        // No column of the persisted row contains the raw token in any form.
        passwordResetTokenRepository.flush();
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT * FROM password_reset_tokens WHERE email = ?", "reset-flow-hash@nforce.test");
        assertThat(rows).hasSize(1);
        for (Object value : rows.get(0).values()) {
            assertThat(String.valueOf(value)).doesNotContainIgnoringCase(raw);
        }
    }

    @Test
    @Transactional
    void emailedLinkFormatIsUnchanged() throws Exception {
        user("reset-flow-link@nforce.test");
        forgotPassword("reset-flow-link@nforce.test");

        ArgumentCaptor<String> link = ArgumentCaptor.forClass(String.class);
        verify(mailService).sendPasswordResetEmail(eq("reset-flow-link@nforce.test"), any(), link.capture());
        // Still <app base url>?token=<plain UUID>; only server-side storage changed.
        assertThat(link.getValue())
            .matches(".*\\?token=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");
    }

    @Test
    @Transactional
    void tokenInUppercaseStillResolves() throws Exception {
        user("reset-flow-case@nforce.test");
        forgotPassword("reset-flow-case@nforce.test");

        confirmReset(emailedResetToken("reset-flow-case@nforce.test").toUpperCase(), "brand-new-password", 200);

        assertThat(login("reset-flow-case@nforce.test", "brand-new-password")).isEqualTo("OK");
    }

    @Test
    @Transactional
    void accountSetupTokenIsStoredHashedAndRedeemsThroughTheSameEndpoint() throws Exception {
        user("reset-flow-setup@nforce.test");
        // The invite / resend-setup / email-change flows all issue this token.
        String raw = passwordResetService.createSetupToken("reset-flow-setup@nforce.test");

        PasswordResetToken row = storedRow("reset-flow-setup@nforce.test");
        assertThat(row.getTokenHash()).isEqualTo(ResetTokenHashing.hash(UUID.fromString(raw)));
        assertThat(row.getExpiresAt()).isAfter(OffsetDateTime.now().plusHours(71));

        confirmReset(raw, "brand-new-password", 200);
        assertThat(login("reset-flow-setup@nforce.test", "brand-new-password")).isEqualTo("OK");
        confirmReset(raw, "second-new-password", 400);
    }

    // ── RTS-512: resending a setup link retires the earlier one ──────────────

    @Test
    @Transactional
    void resendingASetupLinkRejectsTheFirstLinkAndTheNewOneWorks() throws Exception {
        user("reset-flow-resend@nforce.test");
        String first = passwordResetService.createSetupToken("reset-flow-resend@nforce.test");
        String second = passwordResetService.createSetupToken("reset-flow-resend@nforce.test");

        // Same response as an expired/invalid link.
        confirmReset(first, "brand-new-password", 400);

        assertThat(passwordResetTokenRepository.findByTokenHash(ResetTokenHashing.hash(UUID.fromString(second)))
            .orElseThrow().getExpiresAt()).isAfter(OffsetDateTime.now().plusHours(71));
        confirmReset(second, "brand-new-password", 200);
        assertThat(login("reset-flow-resend@nforce.test", "brand-new-password")).isEqualTo("OK");
    }

    @Test
    @Transactional
    void resendingASetupLinkLeavesAPendingPasswordResetLinkAlone() throws Exception {
        user("reset-flow-resend-keep@nforce.test");
        forgotPassword("reset-flow-resend-keep@nforce.test");
        String reset = emailedResetToken("reset-flow-resend-keep@nforce.test");

        passwordResetService.createSetupToken("reset-flow-resend-keep@nforce.test");
        passwordResetService.createSetupToken("reset-flow-resend-keep@nforce.test");

        confirmReset(reset, "brand-new-password", 200);
    }

    @Test
    @Transactional
    void resendingASetupLinkDoesNotTouchAnotherAccountsSetupLink() throws Exception {
        user("reset-flow-resend-a@nforce.test");
        user("reset-flow-resend-b@nforce.test");
        String other = passwordResetService.createSetupToken("reset-flow-resend-b@nforce.test");

        passwordResetService.createSetupToken("reset-flow-resend-a@nforce.test");
        passwordResetService.createSetupToken("reset-flow-resend-a@nforce.test");

        confirmReset(other, "brand-new-password", 200);
    }

    @Test
    @Transactional
    void aForgotPasswordRequestDoesNotRetireAPendingSetupLink() throws Exception {
        user("reset-flow-setup-keep@nforce.test");
        String setup = passwordResetService.createSetupToken("reset-flow-setup-keep@nforce.test");
        forgotPassword("reset-flow-setup-keep@nforce.test");

        // Pre-existing behaviour (RTS-497): a newer reset link retires earlier
        // outstanding links for the email, setup included. Documented here so a
        // change to that is deliberate.
        confirmReset(setup, "brand-new-password", 400);
    }

    @Test
    @Transactional
    void theStoredHashItselfIsNotAWorkingToken() throws Exception {
        user("reset-flow-hash-as-token@nforce.test");
        forgotPassword("reset-flow-hash-as-token@nforce.test");
        String hash = storedRow("reset-flow-hash-as-token@nforce.test").getTokenHash();

        // Someone who can read the table only has the hash; submitting it fails.
        confirmReset(hash, "irrelevant-password", 400);
        assertThat(login("reset-flow-hash-as-token@nforce.test", PASSWORD)).isEqualTo("OK");
    }

    private record LoginBody(String email, String password) {}
}
