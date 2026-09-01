package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.dto.TaskRequest;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import com.nforce.retailops.service.TaskService;
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
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Reproduces the reported bug end-to-end through the real HTTP filter chain: an
// employee logs in, then immediately fetches their store's checklist with the
// exact same token. This is the whole Login -> Store Selection -> Employee Tasks
// path, not a mocked slice of it.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EmployeeChecklistControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private StoreRepository storeRepository;
    @Autowired
    private StoreOwnerRepository storeOwnerRepository;
    @Autowired
    private StoreEmployeeRepository storeEmployeeRepository;
    @Autowired
    private CategoryRepository categoryRepository;
    @Autowired
    private TaskService taskService;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @Transactional
    void employeeStaysAuthenticatedWhenLoadingTheirStoreChecklistRightAfterLogin() throws Exception {
        Role ownerRole = persistRole("OWNER_ADMIN");
        Role employeeRole = persistRole("EMPLOYEE");

        User owner = new User();
        owner.setEmail("owner@nforce.test");
        owner.setFullName("Owner Admin");
        owner.setPasswordHash(passwordEncoder.encode("owner-password-123"));
        owner.getRoles().add(ownerRole);
        owner = userRepository.save(owner);

        User employee = new User();
        employee.setEmail("employee@nforce.test");
        employee.setFullName("Jane Employee");
        employee.setPasswordHash(passwordEncoder.encode("employee-password-123"));
        employee.getRoles().add(employeeRole);
        employee = userRepository.save(employee);

        Store store = new Store();
        store.setName("Store 1");
        store.setLocation("Main St");
        store.setActive(true);
        store = storeRepository.save(store);

        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store);
        storeOwner.setOwner(owner);
        storeOwnerRepository.save(storeOwner);

        StoreEmployee storeEmployee = new StoreEmployee();
        storeEmployee.setEmployee(employee);
        storeEmployee.setStores(new LinkedHashSet<>(Set.of(store)));
        storeEmployee.setPhone("555-0100");
        storeEmployee.setShift("Morning");
        storeEmployee.setEmployeeType("Full Time");
        storeEmployee.setGender("Unspecified");
        storeEmployeeRepository.save(storeEmployee);

        Category category = new Category();
        category.setOwner(owner);
        category.setName("Opening");
        category.setDisplayOrder(0);
        category.setActive(true);
        category = categoryRepository.save(category);

        taskService.createTask(owner.getId(), new TaskRequest(
            "Check Freezer Temperature",
            null,
            category.getId(),
            null,
            false,
            List.of(store.getId()),
            ResponseType.YES_NO,
            null,
            null,
            null,
            null,
            null,
            CompletionType.SINGLE,
            null,
            ScheduleType.EVERY_DAY,
            List.of(),
            LocalDate.now().minusDays(1),
            null,
            TimeMode.ANYTIME,
            null,
            null,
            true
        ));

        String loginBody = objectMapper.writeValueAsString(
            new LoginPayload("employee@nforce.test", "employee-password-123")
        );

        String loginResponseJson = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

        JsonNode loginResponse = objectMapper.readTree(loginResponseJson);
        assertThat(loginResponse.get("role").asText()).isEqualTo("EMPLOYEE");
        String token = loginResponse.get("token").asText();

        // Step 3 of the reported flow: Store Selection reads the assigned-store list.
        mockMvc.perform(get("/api/me/stores").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());

        // Step 5/6 of the reported flow: loading the selected store's task checklist
        // with the SAME token, immediately after. This must not be treated as an
        // expired/invalid session.
        String checklistJson = mockMvc.perform(get("/api/stores/" + store.getId() + "/checklist")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

        JsonNode categories = objectMapper.readTree(checklistJson);
        assertThat(categories.get(0).get("tasks").get(0).get("name").asText())
            .isEqualTo("Check Freezer Temperature");
    }

    @Test
    void corsPreflightForTheChecklistEndpointSucceedsWithoutAuthentication() throws Exception {
        // What the browser actually sends before the real GET, for a cross-origin
        // request carrying a custom Authorization header. This must be handled by
        // the CORS filter itself, before any Spring Security authentication check.
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .options("/api/stores/1/checklist")
                .header("Origin", "http://localhost:5173")
                .header("Access-Control-Request-Method", "GET")
                .header("Access-Control-Request-Headers", "authorization"))
            .andExpect(status().isOk());
    }

    private Role persistRole(String name) {
        Role role = new Role();
        role.setName(name);
        return roleRepository.save(role);
    }

    private record LoginPayload(String email, String password) {
    }
}
