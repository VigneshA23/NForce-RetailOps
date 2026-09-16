package com.nforce.retailops.controller;

import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
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

    private final ObjectMapper objectMapper = new ObjectMapper();

    private Role employeeRole() {
        return roleRepository.findByName("EMPLOYEE").orElseGet(() -> {
            Role role = new Role();
            role.setName("EMPLOYEE");
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
                .jsonPath("$.inactivityTimeoutMinutes").value(30));
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
}
