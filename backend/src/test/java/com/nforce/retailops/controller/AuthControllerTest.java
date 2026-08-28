package com.nforce.retailops.controller;

import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.repository.SuperAdminRepository;
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

    private final ObjectMapper objectMapper = new ObjectMapper();

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
                .jsonPath("$.inactivityTimeoutMinutes").value(10));
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

    private record LoginPayload(String email, String password) {
    }
}
