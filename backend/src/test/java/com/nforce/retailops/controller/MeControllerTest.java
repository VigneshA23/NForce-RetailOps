package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.User;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression coverage for the 401 an authenticated employee hit on
 * PUT /api/me: proves a real (login-issued, not @WithMockUser) JWT is
 * accepted the same way GET /api/me already accepts it.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @Transactional
    void authenticatedEmployeeCanUpdateTheirOwnProfile() throws Exception {
        Role employeeRole = roleRepository.findByName("EMPLOYEE").orElseGet(() -> {
            Role role = new Role();
            role.setName("EMPLOYEE");
            return roleRepository.save(role);
        });

        User user = new User();
        user.setFullName("Original Name");
        user.setEmail("update-me-test@nforce.test");
        user.setPasswordHash(passwordEncoder.encode("original-password"));
        user.getRoles().add(employeeRole);
        userRepository.save(user);

        String token = login("update-me-test@nforce.test", "original-password");

        // Mirror what the real browser does: a CORS preflight ahead of the actual
        // PUT (same-origin MockMvc requests skip this entirely, which is why an
        // Origin header must be set explicitly to exercise the CorsFilter path).
        mockMvc.perform(options("/api/me")
                .header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "PUT")
                .header("Access-Control-Request-Headers", "authorization,content-type"))
            .andExpect(status().isOk())
            .andExpect(header().string("Access-Control-Allow-Methods", org.hamcrest.Matchers.containsString("PUT")));

        mockMvc.perform(put("/api/me")
                .header("Origin", "http://localhost:5173")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"fullName\":\"Updated Name\",\"email\":\"update-me-test@nforce.test\",\"phone\":\"555-1234\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.fullName").value("Updated Name"))
            .andExpect(jsonPath("$.phone").isEmpty());
    }

    @Test
    void updateMeIsRejectedWithoutAuthentication() throws Exception {
        mockMvc.perform(put("/api/me")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"fullName\":\"Someone\",\"email\":\"someone@nforce.test\",\"phone\":\"555-0000\"}"))
            .andExpect(status().isUnauthorized());
    }

    private String login(String email, String password) throws Exception {
        String loginBody = objectMapper.writeValueAsString(new LoginPayload(email, password));
        String responseJson = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

        JsonNode response = objectMapper.readTree(responseJson);
        String token = response.get("token").asText();
        assertThat(token).isNotBlank();
        return token;
    }

    private record LoginPayload(String email, String password) {
    }
}
