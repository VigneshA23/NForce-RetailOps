package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
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
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
    @Autowired
    private StoreRepository storeRepository;
    @Autowired
    private StoreOwnerRepository storeOwnerRepository;
    @Autowired
    private CategoryRepository categoryRepository;
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private TaskResponseEntryRepository taskResponseEntryRepository;
    @Autowired
    private StoreEmployeeRepository storeEmployeeRepository;

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

    // GET /api/me/history/detail -- assigned store, real task + response for the
    // day: returns the categorized checklist, matching MeHistoryServiceTest's
    // service-level coverage but exercised through the real HTTP/JWT/security path.
    @Test
    @Transactional
    void historyDetailForAssignedStoreReturnsCategorizedChecklist() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role employeeRole = role("EMPLOYEE");
        User owner = user("history-detail-owner@nforce.test", ownerRole);
        Store store = store("History Store", 9201L);
        linkOwnerToStore(owner, store);

        Category category = new Category();
        category.setOwner(owner);
        category.setName("Opening");
        category.setDisplayOrder(0);
        category.setActive(true);
        category = categoryRepository.save(category);

        Task task = new Task();
        task.setOwner(owner);
        task.setCategory(category);
        task.setName("Unlock front door");
        task.setDisplayOrder(0);
        task.setAppliesToAllStores(true);
        task.setResponseType(ResponseType.YES_NO);
        task.setCompletionType(CompletionType.SINGLE);
        task.setScheduleType(ScheduleType.EVERY_DAY);
        task.setTimeMode(TimeMode.ANYTIME);
        task.setStartDate(LocalDate.now().minusDays(1));
        task.setActive(true);
        task = taskRepository.save(task);

        User employee = user("history-detail-employee@nforce.test", employeeRole);
        StoreEmployee storeEmployee = new StoreEmployee();
        storeEmployee.setEmployee(employee);
        storeEmployee.setPhone("555-0100");
        storeEmployee.setShift("Morning");
        storeEmployee.setEmployeeType("Full-time");
        storeEmployee.setGender("Other");
        storeEmployee.setStores(new HashSet<>(Set.of(store)));
        storeEmployeeRepository.save(storeEmployee);

        TaskResponseEntry response = new TaskResponseEntry();
        response.setTask(task);
        response.setStore(store);
        response.setEmployee(employee);
        response.setResponseDate(LocalDate.now());
        response.setResponseType(ResponseType.YES_NO);
        response.setCompletionType(CompletionType.SINGLE);
        response.setValueBoolean(true);
        response.setActive(true);
        taskResponseEntryRepository.save(response);

        String token = login("history-detail-employee@nforce.test", PASSWORD);

        mockMvc.perform(get("/api/me/history/detail")
                .header("Authorization", "Bearer " + token)
                .param("storeId", String.valueOf(store.getId()))
                .param("date", LocalDate.now().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.hasChecklist").value(true))
            .andExpect(jsonPath("$.categories[0].tasks[0].completed").value(true))
            .andExpect(jsonPath("$.categories[0].tasks[0].responses[0].empId").exists());
    }

    // GET /api/me/history/detail -- a focused regression check that a real,
    // login-issued JWT for an authenticated employee is accepted by this endpoint
    // the same way it already is by GET /api/me/tasks/today: no @PreAuthorize, no
    // extra security matcher, just the shared /api/me/** authenticated rule. Proves
    // the response is 200 (never 401) for an assigned store, independent of the
    // checklist data shape covered by the tests around it.
    @Test
    @Transactional
    void authenticatedEmployeeReceivesOkNotUnauthorizedFromHistoryDetail() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role employeeRole = role("EMPLOYEE");
        User owner = user("history-detail-auth-owner@nforce.test", ownerRole);
        Store store = store("Auth Check Store", 9204L);
        linkOwnerToStore(owner, store);

        User employee = user("history-detail-auth-employee@nforce.test", employeeRole);
        StoreEmployee storeEmployee = new StoreEmployee();
        storeEmployee.setEmployee(employee);
        storeEmployee.setPhone("555-0100");
        storeEmployee.setShift("Morning");
        storeEmployee.setEmployeeType("Full-time");
        storeEmployee.setGender("Other");
        storeEmployee.setStores(new HashSet<>(Set.of(store)));
        storeEmployeeRepository.save(storeEmployee);

        String token = login("history-detail-auth-employee@nforce.test", PASSWORD);

        mockMvc.perform(get("/api/me/history/detail")
                .header("Authorization", "Bearer " + token)
                .param("storeId", String.valueOf(store.getId()))
                .param("date", LocalDate.now().toString()))
            .andExpect(status().isOk());
    }

    // GET /api/me/history/detail -- a store the caller is not assigned to is masked
    // as "not found", the same way /api/me/tasks/today already behaves.
    @Test
    @Transactional
    void historyDetailForUnassignedStoreIsMaskedAsNotFound() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role employeeRole = role("EMPLOYEE");
        User owner = user("history-detail-owner-2@nforce.test", ownerRole);
        Store store = store("Unassigned Store", 9202L);
        linkOwnerToStore(owner, store);
        user("history-detail-employee-2@nforce.test", employeeRole);

        String token = login("history-detail-employee-2@nforce.test", PASSWORD);

        mockMvc.perform(get("/api/me/history/detail")
                .header("Authorization", "Bearer " + token)
                .param("storeId", String.valueOf(store.getId()))
                .param("date", LocalDate.now().toString()))
            .andExpect(status().isNotFound());
    }

    // GET /api/me/history/detail -- assigned store, nothing configured/recorded for
    // the day: an empty-but-valid response, not an error.
    @Test
    @Transactional
    void historyDetailForAssignedStoreWithNoActivityReturnsEmptyHistory() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role employeeRole = role("EMPLOYEE");
        User owner = user("history-detail-owner-3@nforce.test", ownerRole);
        Store store = store("Quiet Store", 9203L);
        linkOwnerToStore(owner, store);

        User employee = user("history-detail-employee-3@nforce.test", employeeRole);
        StoreEmployee storeEmployee = new StoreEmployee();
        storeEmployee.setEmployee(employee);
        storeEmployee.setPhone("555-0100");
        storeEmployee.setShift("Morning");
        storeEmployee.setEmployeeType("Full-time");
        storeEmployee.setGender("Other");
        storeEmployee.setStores(new HashSet<>(Set.of(store)));
        storeEmployeeRepository.save(storeEmployee);

        String token = login("history-detail-employee-3@nforce.test", PASSWORD);

        mockMvc.perform(get("/api/me/history/detail")
                .header("Authorization", "Bearer " + token)
                .param("storeId", String.valueOf(store.getId()))
                .param("date", LocalDate.now().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.hasChecklist").value(false))
            .andExpect(jsonPath("$.categories").isEmpty());
    }

    private static final String PASSWORD = "correct-horse-battery-staple";

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
