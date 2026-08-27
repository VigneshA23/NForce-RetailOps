package com.nforce.retailops.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser(username = "employee@nforce.test", roles = "EMPLOYEE")
    void logoutReturnsOkForAuthenticatedUser() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
            .andExpect(status().isOk());
    }

    @Test
    void logoutIsRejectedWithoutAuthentication() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
            .andExpect(status().isForbidden());
    }
}
