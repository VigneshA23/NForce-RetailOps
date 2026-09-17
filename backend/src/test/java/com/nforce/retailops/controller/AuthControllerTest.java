package com.nforce.retailops.controller;

import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.entity.ActiveSession;
import com.nforce.retailops.repository.ActiveSessionRepository;
import com.nforce.retailops.repository.PasswordResetTokenRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SuperAdminRepository superAdminRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    private ActiveSessionRepository activeSessionRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private Role employeeRole() {
        return roleRepository.findByName("EMPLOYEE").orElseGet(() -> {
            Role role = new Role();
            role.setName("EMPLOYEE");
            return roleRepository.save(role);
        });
    }

    private Role ownerAdminRole() {
        return roleRepository.findByName("OWNER_ADMIN").orElseGet(() -> {
            Role role = new Role();
            role.setName("OWNER_ADMIN");
            return roleRepository.save(role);
        });
    }

    @Test
    @WithMockUser(username = "employee@nforce.test", roles = "EMPLOYEE")
    void logoutReturnsOkForAuthenticatedUser() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
            .andExpect(status().isOk());
    }

    @Test
    void logoutIsRejectedWithoutAuthentication() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidLoginCredentialsAreRejected() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"no-such-user@nforce.test\",\"password\":\"wrong-password\"}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void sessionConfigIsPubliclyReadableAndReflectsConfiguredTimeout() throws Exception {
        mockMvc.perform(get("/api/auth/session-config"))
            .andExpect(status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .jsonPath("$.inactivityTimeoutMinutes").value(30))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .jsonPath("$.rememberMeTimeoutMinutes").value(240));
    }

    // --- Remember Me session policy -------------------------------------------------

    @Test
    @Transactional
    void loginWithoutRememberMeGrantsTheStandardThirtyMinuteSession() throws Exception {
        User user = new User();
        user.setFullName("Remember Me Off Employee");
        user.setEmail("remember-off-emp@nforce.test");
        user.setPasswordHash(passwordEncoder.encode("correct-password"));
        user.getRoles().add(employeeRole());
        userRepository.save(user);

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"remember-off-emp@nforce.test\",\"password\":\"correct-password\"}"))
            .andExpect(status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .jsonPath("$.sessionTimeoutMinutes").value(30));
    }

    @Test
    @Transactional
    void loginWithRememberMeGrantsTheFourHourSession() throws Exception {
        User user = new User();
        user.setFullName("Remember Me On Owner");
        user.setEmail("remember-on-owner@nforce.test");
        user.setPasswordHash(passwordEncoder.encode("correct-password"));
        user.getRoles().add(ownerAdminRole());
        userRepository.save(user);

        String body = objectMapper.writeValueAsString(
            new LoginPayloadWithRemember("remember-on-owner@nforce.test", "correct-password", true));

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .jsonPath("$.role").value("OWNER_ADMIN"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .jsonPath("$.sessionTimeoutMinutes").value(240));
    }

    @Test
    @Transactional
    void superAdminLoginWithRememberMeAlsoGrantsTheFourHourSession() throws Exception {
        SuperAdmin superAdmin = new SuperAdmin();
        superAdmin.setName("Remember Me Super Admin");
        superAdmin.setEmail("remember-on-sa@nforce.test");
        superAdmin.setPasswordHash(passwordEncoder.encode("correct-horse-battery-staple"));
        superAdminRepository.save(superAdmin);

        String body = objectMapper.writeValueAsString(
            new LoginPayloadWithRemember("remember-on-sa@nforce.test", "correct-horse-battery-staple", true));

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .jsonPath("$.role").value("SUPER_ADMIN"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .jsonPath("$.sessionTimeoutMinutes").value(240));
    }

    // A session whose absolute expiry has passed must be rejected on the very
    // next request, even though the JWT itself (signed for the same 30-minute
    // window) has not yet reached its own cryptographic expiry in this test.
    @Test
    @Transactional
    void sessionPastItsAbsoluteExpiryIsRejectedOnTheNextRequest() throws Exception {
        User user = new User();
        user.setFullName("Expiring Session Employee");
        user.setEmail("expiring-session@nforce.test");
        user.setPasswordHash(passwordEncoder.encode("correct-password"));
        user.getRoles().add(employeeRole());
        userRepository.save(user);

        String loginBody = objectMapper.writeValueAsString(
            new LoginPayload("expiring-session@nforce.test", "correct-password"));
        String responseJson = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        String token = objectMapper.readTree(responseJson).get("token").asText();

        // Still valid right after login.
        mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());

        // Re-login (the logout above already revoked that session) and this
        // time force its absolute expiry into the past, simulating time having
        // passed, without needing to actually wait 30 minutes in the test.
        responseJson = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        token = objectMapper.readTree(responseJson).get("token").asText();

        String tokenId = extractTokenId(token);
        ActiveSession session = activeSessionRepository.findByTokenId(tokenId).orElseThrow();
        session.setExpiresAt(OffsetDateTime.now().minusMinutes(1));
        activeSessionRepository.save(session);

        mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized());
    }

    // --- Session status (accurate remaining time for the frontend's UX countdown) ---

    @Test
    void sessionStatusIsRejectedWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/api/auth/session-status"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional
    void sessionStatusReportsCloseToTheFullThirtyMinutesRightAfterLogin() throws Exception {
        User user = new User();
        user.setFullName("Session Status Employee");
        user.setEmail("session-status-emp@nforce.test");
        user.setPasswordHash(passwordEncoder.encode("correct-password"));
        user.getRoles().add(employeeRole());
        userRepository.save(user);

        String loginBody = objectMapper.writeValueAsString(
            new LoginPayload("session-status-emp@nforce.test", "correct-password"));
        String responseJson = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        String token = objectMapper.readTree(responseJson).get("token").asText();

        String statusJson = mockMvc.perform(get("/api/auth/session-status").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        long remainingSeconds = objectMapper.readTree(statusJson).get("remainingSeconds").asLong();

        // 30 minutes = 1800s; allow a small tolerance for test execution time.
        assertThat(remainingSeconds).isBetween(1790L, 1800L);
    }

    // Proves the value reflects the session's ACTUAL remaining time rather
    // than always reporting the full policy duration -- the exact defect
    // this endpoint exists to let the frontend correct after a page refresh.
    @Test
    @Transactional
    void sessionStatusReflectsElapsedTimeNotTheFullDuration() throws Exception {
        User user = new User();
        user.setFullName("Session Status Elapsed Employee");
        user.setEmail("session-status-elapsed@nforce.test");
        user.setPasswordHash(passwordEncoder.encode("correct-password"));
        user.getRoles().add(employeeRole());
        userRepository.save(user);

        String loginBody = objectMapper.writeValueAsString(
            new LoginPayload("session-status-elapsed@nforce.test", "correct-password"));
        String responseJson = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        String token = objectMapper.readTree(responseJson).get("token").asText();

        // Simulate 25 of the 30 minutes already having elapsed.
        String tokenId = extractTokenId(token);
        ActiveSession session = activeSessionRepository.findByTokenId(tokenId).orElseThrow();
        session.setExpiresAt(OffsetDateTime.now().plusMinutes(5));
        activeSessionRepository.save(session);

        String statusJson = mockMvc.perform(get("/api/auth/session-status").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        long remainingSeconds = objectMapper.readTree(statusJson).get("remainingSeconds").asLong();

        assertThat(remainingSeconds).isBetween(290L, 300L);
    }

    @Test
    @Transactional
    void sessionStatusReflectsFourHoursForARememberMeSession() throws Exception {
        User user = new User();
        user.setFullName("Session Status Remember Me Owner");
        user.setEmail("session-status-remember@nforce.test");
        user.setPasswordHash(passwordEncoder.encode("correct-password"));
        user.getRoles().add(ownerAdminRole());
        userRepository.save(user);

        String loginBody = objectMapper.writeValueAsString(
            new LoginPayloadWithRemember("session-status-remember@nforce.test", "correct-password", true));
        String responseJson = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        String token = objectMapper.readTree(responseJson).get("token").asText();

        String statusJson = mockMvc.perform(get("/api/auth/session-status").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        long remainingSeconds = objectMapper.readTree(statusJson).get("remainingSeconds").asLong();

        // 4 hours = 14400s; allow a small tolerance for test execution time.
        assertThat(remainingSeconds).isBetween(14390L, 14400L);
    }

    @Test
    @Transactional
    void sessionStatusIsRejectedAfterLogout() throws Exception {
        User user = new User();
        user.setFullName("Session Status Logout Employee");
        user.setEmail("session-status-logout@nforce.test");
        user.setPasswordHash(passwordEncoder.encode("correct-password"));
        user.getRoles().add(employeeRole());
        userRepository.save(user);

        String loginBody = objectMapper.writeValueAsString(
            new LoginPayload("session-status-logout@nforce.test", "correct-password"));
        String responseJson = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        String token = objectMapper.readTree(responseJson).get("token").asText();

        mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/auth/session-status").header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized());
    }

    // Decodes the JWT's own "jti" claim without needing JwtService injected
    // into this MockMvc test -- the token id is the middle base64url segment's
    // "jti" field, same claim JwtService.extractTokenId reads.
    private String extractTokenId(String jwt) throws Exception {
        String[] parts = jwt.split("\\.");
        String payloadJson = new String(java.util.Base64.getUrlDecoder().decode(parts[1]));
        return objectMapper.readTree(payloadJson).get("jti").asText();
    }

    @Test
    @Transactional
    void validLoginIssuesTokenAndLogoutInvalidatesItForFurtherUse() throws Exception {
        SuperAdmin superAdmin = new SuperAdmin();
        superAdmin.setName("Test Super Admin");
        superAdmin.setEmail("session-test-admin@nforce.test");
        superAdmin.setPasswordHash(passwordEncoder.encode("correct-horse-battery-staple"));
        superAdminRepository.save(superAdmin);

        String loginBody = objectMapper.writeValueAsString(new LoginPayload(
            "session-test-admin@nforce.test", "correct-horse-battery-staple"
        ));

        String responseJson = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

        JsonNode response = objectMapper.readTree(responseJson);
        String token = response.get("token").asText();
        assertThat(response.get("role").asText()).isEqualTo("SUPER_ADMIN");

        // A freshly issued, valid session is accepted for a protected endpoint.
        mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());

        // Logout revoked the session server-side: the same (still cryptographically
        // valid, unexpired) token must now be rejected as unauthenticated.
        mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional
    void changePasswordRejectsAnIncorrectCurrentPasswordButAcceptsTheCorrectOne() throws Exception {
        // Flyway is disabled for the test profile, so roles aren't seeded --
        // create one directly, the same way other integration tests do.
        Role employeeRole = roleRepository.findByName("EMPLOYEE").orElseGet(() -> {
            Role role = new Role();
            role.setName("EMPLOYEE");
            return roleRepository.save(role);
        });

        User user = new User();
        user.setFullName("Change Password Test");
        user.setEmail("change-pw-test@nforce.test");
        user.setPasswordHash(passwordEncoder.encode("original-password"));
        user.getRoles().add(employeeRole);
        userRepository.save(user);

        String loginBody = objectMapper.writeValueAsString(new LoginPayload(
            "change-pw-test@nforce.test", "original-password"
        ));
        String responseJson = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
        String token = objectMapper.readTree(responseJson).get("token").asText();

        // The current password must be verified -- an incorrect one is rejected,
        // unlike /reset-password which trusts the session alone.
        mockMvc.perform(post("/api/auth/change-password")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"wrong-password\",\"newPassword\":\"brand-new-password\"}"))
            .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/auth/change-password")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"original-password\",\"newPassword\":\"brand-new-password\"}"))
            .andExpect(status().isOk());

        // The new password now works for login.
        String reloginBody = objectMapper.writeValueAsString(new LoginPayload(
            "change-pw-test@nforce.test", "brand-new-password"
        ));
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(reloginBody))
            .andExpect(status().isOk());
    }

    // --- Email whitespace handling -------------------------------------------------

    @Test
    @Transactional
    void loginSucceedsWithExactEmailNoWhitespace() throws Exception {
        User user = new User();
        user.setFullName("Whitespace Test User");
        user.setEmail("ws-exact@nforce.test");
        user.setPasswordHash(passwordEncoder.encode("correct-password"));
        user.getRoles().add(employeeRole());
        userRepository.save(user);

        String body = objectMapper.writeValueAsString(new LoginPayload("ws-exact@nforce.test", "correct-password"));

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk());
    }

    @Test
    @Transactional
    void loginWithLeadingWhitespaceInEmailIsRejected() throws Exception {
        User user = new User();
        user.setFullName("Whitespace Test User");
        user.setEmail("ws-leading@nforce.test");
        user.setPasswordHash(passwordEncoder.encode("correct-password"));
        user.getRoles().add(employeeRole());
        userRepository.save(user);

        String body = objectMapper.writeValueAsString(new LoginPayload(" ws-leading@nforce.test", "correct-password"));

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isUnauthorized())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    @Transactional
    void loginWithTrailingWhitespaceInEmailIsRejected() throws Exception {
        User user = new User();
        user.setFullName("Whitespace Test User");
        user.setEmail("ws-trailing@nforce.test");
        user.setPasswordHash(passwordEncoder.encode("correct-password"));
        user.getRoles().add(employeeRole());
        userRepository.save(user);

        String body = objectMapper.writeValueAsString(new LoginPayload("ws-trailing@nforce.test ", "correct-password"));

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isUnauthorized())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    @Transactional
    void loginWithLeadingAndTrailingWhitespaceInEmailIsRejected() throws Exception {
        User user = new User();
        user.setFullName("Whitespace Test User");
        user.setEmail("ws-both@nforce.test");
        user.setPasswordHash(passwordEncoder.encode("correct-password"));
        user.getRoles().add(employeeRole());
        userRepository.save(user);

        String body = objectMapper.writeValueAsString(new LoginPayload(" ws-both@nforce.test ", "correct-password"));

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isUnauthorized())
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .jsonPath("$.message").value("Invalid email or password"));
    }

    // The email-whitespace guard must not affect the password: a password that
    // legitimately contains a trailing space is matched exactly, not trimmed.
    @Test
    @Transactional
    void passwordIsNotTrimmedBeforeAuthentication() throws Exception {
        User user = new User();
        user.setFullName("Password Whitespace Test User");
        user.setEmail("pw-whitespace@nforce.test");
        user.setPasswordHash(passwordEncoder.encode("secret-password "));
        user.getRoles().add(employeeRole());
        userRepository.save(user);

        // The exact password, trailing space included, authenticates.
        String exactBody = objectMapper.writeValueAsString(
            new LoginPayload("pw-whitespace@nforce.test", "secret-password "));
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(exactBody))
            .andExpect(status().isOk());

        // A silently-trimmed version of the same password must NOT authenticate.
        String trimmedBody = objectMapper.writeValueAsString(
            new LoginPayload("pw-whitespace@nforce.test", "secret-password"));
        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(trimmedBody))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @Transactional
    void forgotPasswordWithWhitespaceInEmailDoesNotCreateResetTokenEvenForExistingUser() throws Exception {
        User user = new User();
        user.setFullName("Forgot Password Whitespace Test");
        user.setEmail("forgot-pw-whitespace@nforce.test");
        user.setPasswordHash(passwordEncoder.encode("some-password"));
        user.getRoles().add(employeeRole());
        userRepository.save(user);

        long before = passwordResetTokenRepository.count();

        // Leading space — both endpoints return 200 either way (anti-enumeration
        // design), but no token should be created for a whitespace-padded email.
        mockMvc.perform(post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\" forgot-pw-whitespace@nforce.test\"}"))
            .andExpect(status().isOk());

        // Trailing space
        mockMvc.perform(post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"forgot-pw-whitespace@nforce.test \"}"))
            .andExpect(status().isOk());

        assertThat(passwordResetTokenRepository.count()).isEqualTo(before);

        // Sanity check: the exact, unpadded email for the same account DOES create
        // a token — proving the rejections above were caused by the whitespace,
        // not by the account not existing.
        mockMvc.perform(post("/api/auth/forgot-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"forgot-pw-whitespace@nforce.test\"}"))
            .andExpect(status().isOk());

        assertThat(passwordResetTokenRepository.count()).isEqualTo(before + 1);
    }

    private record LoginPayload(String email, String password) {
    }

    private record LoginPayloadWithRemember(String email, String password, boolean rememberMe) {
    }
}
