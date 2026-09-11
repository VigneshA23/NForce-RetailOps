package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Mirrors ChecklistHistoryControllerTest: seeds real users via repositories inside a
// @Transactional test method, then goes through a real /api/auth/login round trip to get
// a bearer token, rather than @WithMockUser -- Super Admin authenticates as a distinct
// SuperAdminUserDetails principal that only a real SuperAdmin-table login produces.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CategoryControllerRoleAccessTest {

    private static final String PASSWORD = "correct-horse-battery-staple";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private SuperAdminRepository superAdminRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private Role role(String name) {
        return roleRepository.findByName(name).orElseGet(() -> {
            Role role = new Role();
            role.setName(name);
            role.setDescription(name);
            return roleRepository.save(role);
        });
    }

    private User user(String email, Role role) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setFullName("Test User");
        user.getRoles().add(role);
        return userRepository.save(user);
    }

    private SuperAdmin superAdmin(String email) {
        SuperAdmin sa = new SuperAdmin();
        sa.setName("Test Super Admin");
        sa.setEmail(email);
        sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
        return superAdminRepository.save(sa);
    }

    private String login(String email) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginPayload(email, PASSWORD));
        String responseJson = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
        return objectMapper.readTree(responseJson).get("token").asText();
    }

    @Test
    @Transactional
    void employeeIsForbiddenFromListingCategories() throws Exception {
        Role employeeRole = role("EMPLOYEE");
        user("category-employee@nforce.test", employeeRole);
        String token = login("category-employee@nforce.test");

        mockMvc.perform(get("/api/categories")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void ownerAdminCanListCategories() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        user("category-owner-a@nforce.test", ownerRole);
        String token = login("category-owner-a@nforce.test");

        mockMvc.perform(get("/api/categories")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());
    }

    @Test
    @Transactional
    void superAdminCanListCategories() throws Exception {
        // Real SuperAdmin entity -- gets SuperAdminUserDetails, the principal type
        // that would NPE if the controller ever bound @AuthenticationPrincipal
        // AppUserDetails on this path instead of branching on Authentication.
        superAdmin("category-superadmin-a@nforce.test");
        String token = login("category-superadmin-a@nforce.test");

        mockMvc.perform(get("/api/categories")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());
    }

    @Test
    @Transactional
    void ownerAdminIsForbiddenFromCreatingCategories() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        user("category-owner-b@nforce.test", ownerRole);
        String token = login("category-owner-b@nforce.test");

        String body = objectMapper.writeValueAsString(new CategoryRequestPayload("Opening", true, java.util.List.of()));

        mockMvc.perform(post("/api/categories")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void ownerAdminIsForbiddenFromDeletingCategories() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        user("category-owner-c@nforce.test", ownerRole);
        String token = login("category-owner-c@nforce.test");

        mockMvc.perform(delete("/api/categories/999")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void superAdminCanCreateACategory() throws Exception {
        superAdmin("category-superadmin-b@nforce.test");
        String token = login("category-superadmin-b@nforce.test");

        String body = objectMapper.writeValueAsString(new CategoryRequestPayload("Opening", true, java.util.List.of()));

        mockMvc.perform(post("/api/categories")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isCreated());
    }

    private record LoginPayload(String email, String password) {
    }

    private record CategoryRequestPayload(String name, boolean appliesToAllStores, java.util.List<Long> storeIds) {
    }
}
