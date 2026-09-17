package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.RaisedIssue;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.RaisedIssueRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SuperAdminOperationsControllerTest {

    private static final String PASSWORD = "correct-horse-battery-staple";

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskResponseEntryRepository taskResponseEntryRepository;
    @Autowired private StoreEmployeeRepository storeEmployeeRepository;
    @Autowired private RaisedIssueRepository raisedIssueRepository;
    @Autowired private SuperAdminRepository superAdminRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private Role role(String name) {
        return roleRepository.findByName(name).orElseGet(() -> {
            Role role = new Role();
            role.setName(name);
            role.setDescription(name);
            return roleRepository.save(role);
        });
    }

    private User ownerUser(String email) {
        Role ownerRole = role("OWNER_ADMIN");
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setFullName("Test Owner");
        user.getRoles().add(ownerRole);
        return userRepository.save(user);
    }

    private User employeeUser(String email) {
        Role empRole = role("EMPLOYEE");
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(PASSWORD));
        user.setFullName("Test Employee");
        user.getRoles().add(empRole);
        return userRepository.save(user);
    }

    private Store store(String name, long storeCode) {
        Store store = new Store();
        store.setName(name);
        store.setStoreCode(storeCode);
        store.setActive(true);
        return storeRepository.save(store);
    }

    private StoreOwner linkOwnerToStore(User owner, Store store) {
        StoreOwner link = new StoreOwner();
        link.setOwner(owner);
        link.setStore(store);
        return storeOwnerRepository.save(link);
    }

    private Task task(User owner, Category category, Store store) {
        Task t = new Task();
        t.setOwner(owner);
        t.setCategory(category);
        t.setName("Test Task");
        t.setDisplayOrder(0);
        t.setAppliesToAllStores(false);
        t.getStores().add(store);
        t.setResponseType(ResponseType.YES_NO);
        t.setCompletionType(CompletionType.SINGLE);
        t.setScheduleType(ScheduleType.EVERY_DAY);
        t.setTimeMode(TimeMode.ANYTIME);
        t.setStartDate(LocalDate.now().minusDays(1));
        t.setActive(true);
        return taskRepository.save(t);
    }

    private Category category(User owner) {
        Category cat = new Category();
        cat.setOwner(owner);
        cat.setName("Test Category");
        cat.setDisplayOrder(0);
        cat.setActive(true);
        return categoryRepository.save(cat);
    }

    private TaskResponseEntry response(Task task, Store store, User employee) {
        TaskResponseEntry r = new TaskResponseEntry();
        r.setTask(task);
        r.setStore(store);
        r.setEmployee(employee);
        r.setResponseDate(LocalDate.now());
        r.setResponseType(ResponseType.YES_NO);
        r.setCompletionType(CompletionType.SINGLE);
        r.setValueBoolean(true);
        r.setActive(true);
        return taskResponseEntryRepository.save(r);
    }

    private StoreEmployee storeEmployee(User employee, Store store) {
        StoreEmployee se = new StoreEmployee();
        se.setEmployee(employee);
        se.setPhone("555-0100");
        se.setShift("Morning");
        se.setEmployeeType("Full-time");
        se.setGender("Other");
        se.getStores().add(store);
        return storeEmployeeRepository.save(se);
    }

    private RaisedIssue openIssue(Store store, User employee) {
        RaisedIssue issue = new RaisedIssue();
        issue.setStore(store);
        issue.setEmployeeUser(employee);
        issue.setNote("Something needs attention");
        issue.setStatus("OPEN");
        return raisedIssueRepository.save(issue);
    }

    private SuperAdmin superAdmin(String email) {
        SuperAdmin sa = new SuperAdmin();
        sa.setName("Super Admin");
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
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(responseJson).get("token").asText();
    }

    @Test
    @Transactional
    void operationsOverviewRequiresSuperAdminRole() throws Exception {
        User owner = ownerUser("sa-ops-owner-a@nforce.test");
        String ownerToken = login("sa-ops-owner-a@nforce.test");

        mockMvc.perform(get("/api/super-admin/operations-overview")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void platformStatsRequiresSuperAdminRole() throws Exception {
        ownerUser("sa-ops-owner-b@nforce.test");
        String ownerToken = login("sa-ops-owner-b@nforce.test");

        mockMvc.perform(get("/api/super-admin/platform-stats")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void operationsOverviewReturnsSummaryForEachStore() throws Exception {
        SuperAdmin sa = superAdmin("sa-ops-admin-c@nforce.test");
        User owner = ownerUser("sa-ops-owner-c@nforce.test");
        Store storeA = store("Store Alpha", 9200L);
        Store storeB = store("Store Beta", 9201L);
        linkOwnerToStore(owner, storeA);
        linkOwnerToStore(owner, storeB);

        Category cat = category(owner);
        Task taskA = task(owner, cat, storeA);
        User emp = employeeUser("sa-ops-emp-c@nforce.test");
        response(taskA, storeA, emp);

        String token = login("sa-ops-admin-c@nforce.test");

        mockMvc.perform(get("/api/super-admin/operations-overview")
                .header("Authorization", "Bearer " + token)
                .param("date", LocalDate.now().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }

    @Test
    @Transactional
    void platformStatsReturnsCorrectAggregates() throws Exception {
        superAdmin("sa-ops-admin-d@nforce.test");
        User owner = ownerUser("sa-ops-owner-d@nforce.test");
        Store storeC = store("Store Gamma", 9202L);
        linkOwnerToStore(owner, storeC);

        Category cat = category(owner);
        Task t = task(owner, cat, storeC);
        User emp = employeeUser("sa-ops-emp-d@nforce.test");
        response(t, storeC, emp);

        String token = login("sa-ops-admin-d@nforce.test");

        mockMvc.perform(get("/api/super-admin/platform-stats")
                .header("Authorization", "Bearer " + token)
                .param("date", LocalDate.now().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalStores").isNumber())
            .andExpect(jsonPath("$.platformCompletionPercent").isNumber())
            .andExpect(jsonPath("$.totalOpenIssues").isNumber())
            .andExpect(jsonPath("$.storesWithActivity").isNumber())
            .andExpect(jsonPath("$.totalTasksToday").value(1))
            .andExpect(jsonPath("$.completedTasksToday").value(1))
            .andExpect(jsonPath("$.employeesActiveToday").value(1))
            .andExpect(jsonPath("$.storesWithOpenIssues").value(0))
            .andExpect(jsonPath("$.totalEmployees").isNumber());
    }

    // Dedicated coverage for the "Platform Health" panel's fields: one store with
    // a real StoreEmployee row and today's activity, one store with an open issue
    // and no activity at all -- exercises storesWithOpenIssues, totalEmployees and
    // employeesActiveToday together rather than as loose isNumber() checks.
    @Test
    @Transactional
    void platformStatsCountsActiveEmployeesAndStoresWithOpenIssues() throws Exception {
        superAdmin("sa-ops-admin-h@nforce.test");
        User owner = ownerUser("sa-ops-owner-h@nforce.test");
        Store activeStore = store("Store Health Active", 9220L);
        Store idleStore = store("Store Health Idle", 9221L);
        linkOwnerToStore(owner, activeStore);
        linkOwnerToStore(owner, idleStore);

        Category cat = category(owner);
        Task t = task(owner, cat, activeStore);
        User emp = employeeUser("sa-ops-emp-h@nforce.test");
        storeEmployee(emp, activeStore);
        response(t, activeStore, emp);

        User idleEmployee = employeeUser("sa-ops-emp-idle-h@nforce.test");
        openIssue(idleStore, idleEmployee);

        String token = login("sa-ops-admin-h@nforce.test");

        mockMvc.perform(get("/api/super-admin/platform-stats")
                .header("Authorization", "Bearer " + token)
                .param("date", LocalDate.now().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalStores").value(2))
            .andExpect(jsonPath("$.storesWithActivity").value(1))
            .andExpect(jsonPath("$.storesWithOpenIssues").value(1))
            .andExpect(jsonPath("$.totalEmployees").value(1))
            .andExpect(jsonPath("$.employeesActiveToday").value(1));
    }

    @Test
    @Transactional
    void platformStatsZeroStoresReturnsZeros() throws Exception {
        superAdmin("sa-ops-admin-e@nforce.test");
        String token = login("sa-ops-admin-e@nforce.test");

        mockMvc.perform(get("/api/super-admin/platform-stats")
                .header("Authorization", "Bearer " + token)
                .param("date", LocalDate.now().minusYears(10).toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.platformCompletionPercent").value(0));
    }

    @Test
    @Transactional
    void superAdminCanViewChecklistDetail() throws Exception {
        superAdmin("sa-chk-admin-f@nforce.test");
        User owner = ownerUser("sa-chk-owner-f@nforce.test");
        Store storeF = store("Store Felix", 9210L);
        linkOwnerToStore(owner, storeF);

        String token = login("sa-chk-admin-f@nforce.test");

        mockMvc.perform(get("/api/checklist-history/detail")
                .header("Authorization", "Bearer " + token)
                .param("storeId", String.valueOf(storeF.getId()))
                .param("date", LocalDate.now().toString()))
            .andExpect(status().isOk());
    }

    @Test
    @Transactional
    void superAdminCorrectChecklistResponseReturnsNotFoundForMissingId() throws Exception {
        superAdmin("sa-chk-admin-g@nforce.test");
        String token = login("sa-chk-admin-g@nforce.test");

        // Super Admin is now allowed to correct; non-existent ID returns 404, not 403
        mockMvc.perform(patch("/api/checklist-history/responses/99999/correct")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isNotFound());
    }

    record LoginPayload(String email, String password) {}
}
