package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
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

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Mirrors ChecklistHistoryControllerTest: a real login round trip, since
// StoreInventoryController's @AuthenticationPrincipal AppUserDetails needs a
// real, DB-backed principal that @WithMockUser doesn't provide.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StoreInventoryControllerTest {

    private static final String PASSWORD = "correct-horse-battery-staple";

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private Role ownerRole() {
        return roleRepository.findByName("OWNER_ADMIN").orElseGet(() -> {
            Role role = new Role();
            role.setName("OWNER_ADMIN");
            role.setDescription("OWNER_ADMIN");
            return roleRepository.save(role);
        });
    }

    private User owner(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setFullName("Test Owner");
        user.getRoles().add(ownerRole());
        return userRepository.save(user);
    }

    private Store store(String name, long storeCode) {
        Store store = new Store();
        store.setName(name);
        store.setStoreCode(storeCode);
        store.setActive(true);
        return storeRepository.save(store);
    }

    private void linkOwnerToStore(User owner, Store store) {
        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setOwner(owner);
        storeOwner.setStore(store);
        storeOwnerRepository.save(storeOwner);
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
    void rangeOverNinetyTwoDaysIsRejectedWithACapMentioningMessage() throws Exception {
        User owner = owner("stockcheck-history-cap@nforce.test");
        linkOwnerToStore(owner, store("Cap Store", 9200L));
        String token = login("stockcheck-history-cap@nforce.test");

        mockMvc.perform(get("/api/stores/inventory/stock-checks")
                .header("Authorization", "Bearer " + token)
                .param("startDate", LocalDate.of(2026, 1, 1).toString())
                .param("endDate", LocalDate.of(2026, 12, 31).toString()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Date range cannot exceed 92 days"));
    }

    @Test
    @Transactional
    void missingDateBoundIsRejectedAsBadRequestNotServerError() throws Exception {
        User owner = owner("stockcheck-history-missing@nforce.test");
        linkOwnerToStore(owner, store("Missing Bound Store", 9201L));
        String token = login("stockcheck-history-missing@nforce.test");

        mockMvc.perform(get("/api/stores/inventory/stock-checks")
                .header("Authorization", "Bearer " + token)
                .param("startDate", LocalDate.of(2026, 6, 1).toString()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Both startDate and endDate are required"));
    }

    @Test
    @Transactional
    void oversizedPageSizeIsClampedToTheServerMaximum() throws Exception {
        User owner = owner("stockcheck-history-clamp@nforce.test");
        linkOwnerToStore(owner, store("Clamp Store", 9202L));
        String token = login("stockcheck-history-clamp@nforce.test");

        mockMvc.perform(get("/api/stores/inventory/stock-checks")
                .header("Authorization", "Bearer " + token)
                .param("startDate", LocalDate.of(2026, 6, 1).toString())
                .param("endDate", LocalDate.of(2026, 6, 7).toString())
                .param("size", "9999"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.pageSize").value(200))
            .andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    @Transactional
    void employeeRoleIsForbiddenFromStockCheckHistory() throws Exception {
        Role employeeRole = roleRepository.findByName("EMPLOYEE").orElseGet(() -> {
            Role role = new Role();
            role.setName("EMPLOYEE");
            role.setDescription("EMPLOYEE");
            return roleRepository.save(role);
        });
        User employee = new User();
        employee.setEmail("stockcheck-history-employee@nforce.test");
        employee.setPasswordHash(passwordEncoder.encode(PASSWORD));
        employee.setFullName("Test Employee");
        employee.getRoles().add(employeeRole);
        userRepository.save(employee);
        String token = login("stockcheck-history-employee@nforce.test");

        mockMvc.perform(get("/api/stores/inventory/stock-checks")
                .header("Authorization", "Bearer " + token)
                .param("startDate", LocalDate.of(2026, 6, 1).toString())
                .param("endDate", LocalDate.of(2026, 6, 7).toString()))
            .andExpect(status().isForbidden());
    }

    private record LoginPayload(String email, String password) {
    }
}
