package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.TaskRepository;
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
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// End-to-end coverage for the "Recent Activity" feed: exercises the real
// instrumented actions (category creation, issue reporting, task response
// submission) through their actual HTTP endpoints, then reads GET
// /api/activity back as each role, to prove both the store-scoping (Owner
// Admin sees only their own store) and the feed split -- Super Admin sees
// Owner-Admin/Employee activity platform-wide but never task completions or
// their own Super-Admin-authored actions, while an Owner Admin sees only
// their own store's task completions, never admin-action events -- rather
// than just unit-testing ActivityLogService in isolation.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ActivityLogControllerTest {

    private static final String PASSWORD = "correct-horse-battery-staple";
    private static final AtomicLong STORE_CODE = new AtomicLong(97000);

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private StoreEmployeeRepository storeEmployeeRepository;
    @Autowired private SuperAdminRepository superAdminRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private Role role(String name) {
        return roleRepository.findByName(name).orElseGet(() -> {
            Role r = new Role();
            r.setName(name);
            r.setDescription(name);
            return roleRepository.save(r);
        });
    }

    private User user(String email, Role role) {
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode(PASSWORD));
        u.setFullName("Test User " + email);
        u.getRoles().add(role);
        return userRepository.save(u);
    }

    private Store store(String name) {
        Store s = new Store();
        s.setName(name);
        s.setStoreCode(STORE_CODE.getAndIncrement());
        s.setActive(true);
        return storeRepository.save(s);
    }

    private void linkOwnerToStore(User owner, Store store) {
        StoreOwner so = new StoreOwner();
        so.setOwner(owner);
        so.setStore(store);
        storeOwnerRepository.save(so);
    }

    private StoreEmployee storeEmployee(User employee, Store store) {
        StoreEmployee se = new StoreEmployee();
        se.setEmployee(employee);
        se.setPhone("555-0100");
        se.setEmployeeType("Full-time");
        se.setGender("Other");
        se.getStores().add(store);
        return storeEmployeeRepository.save(se);
    }

    private Category category(Store store) {
        Category c = new Category();
        c.setName("Activity Task Category " + store.getId());
        c.setAppliesToAllStores(false);
        c.getStores().add(store);
        return categoryRepository.save(c);
    }

    // EVERY_DAY/ANYTIME with a startDate of today, so it's always due today
    // regardless of which weekday the test happens to run on.
    private Task task(Category category, Store store, String name) {
        Task t = new Task();
        t.setCategory(category);
        t.setName(name);
        t.setAppliesToAllStores(false);
        t.getStores().add(store);
        t.setResponseType(ResponseType.YES_NO);
        t.setCompletionType(CompletionType.SINGLE);
        t.setScheduleType(ScheduleType.EVERY_DAY);
        t.setStartDate(LocalDate.now());
        return taskRepository.save(t);
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
        String json = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("token").asText();
    }

    @Test
    @Transactional
    void employeeIsForbiddenFromReadingActivity() throws Exception {
        Role empRole = role("EMPLOYEE");
        user("activity-emp-a@nforce.test", empRole);
        String token = login("activity-emp-a@nforce.test");

        mockMvc.perform(get("/api/activity")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void superAdminDoesNotSeeTheirOwnActionsOnlyOwnerAndEmployeeActivity() throws Exception {
        superAdmin("activity-sa-a@nforce.test");
        String saToken = login("activity-sa-a@nforce.test");

        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("activity-owner-a@nforce.test", ownerRole);
        User employee = user("activity-emp-a@nforce.test", empRole);
        Store store = store("Activity Store A");
        linkOwnerToStore(owner, store);
        storeEmployee(employee, store);

        // A Super-Admin-authored action (category creation) must never surface
        // in Super Admin's own feed -- watching your own actions played back
        // to you isn't oversight, and every such row is attributed to the
        // literal string "Super Admin" anyway, not a specific account.
        String categoryBody = objectMapper.writeValueAsString(
            new CategoryRequestPayload("Activity Category A", false, List.of(store.getId())));
        mockMvc.perform(post("/api/categories")
                .header("Authorization", "Bearer " + saToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(categoryBody))
            .andExpect(status().isCreated());

        mockMvc.perform(get("/api/activity").header("Authorization", "Bearer " + saToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", org.hamcrest.Matchers.not(
                org.hamcrest.Matchers.hasItem(
                    org.hamcrest.Matchers.hasEntry("description", "Created category \"Activity Category A\"")))));

        // But an Employee's own action (reporting an issue) is genuine
        // cross-role oversight and must still show up.
        String employeeToken = login("activity-emp-a@nforce.test");
        String issueBody = objectMapper.writeValueAsString(new RaiseIssuePayload(store.getId(), "Freezer is warm"));
        mockMvc.perform(post("/api/me/issues")
                .header("Authorization", "Bearer " + employeeToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(issueBody))
            .andExpect(status().isCreated());

        mockMvc.perform(get("/api/activity").header("Authorization", "Bearer " + saToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].description").value("Reported an issue"))
            .andExpect(jsonPath("$[0].actorRole").value("EMPLOYEE"));
    }

    @Test
    @Transactional
    void ownerAdminSeesOnlyTaskCompletionsForTheirOwnStoreNotAnotherOwners() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User ownerA = user("activity-owner-b@nforce.test", ownerRole);
        User ownerB = user("activity-owner-c@nforce.test", ownerRole);
        User employeeA = user("activity-emp-b@nforce.test", empRole);
        Store storeA = store("Activity Store B");
        Store storeB = store("Activity Store C");
        linkOwnerToStore(ownerA, storeA);
        linkOwnerToStore(ownerB, storeB);
        storeEmployee(employeeA, storeA);
        Category category = category(storeA);
        Task task = task(category, storeA, "Store B Only Task");

        String employeeToken = login("activity-emp-b@nforce.test");
        String responseBody = objectMapper.writeValueAsString(new TaskResponsePayload(storeA.getId(), true, null, null));
        mockMvc.perform(post("/api/me/tasks/{taskId}/responses", task.getId())
                .header("Authorization", "Bearer " + employeeToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(responseBody))
            .andExpect(status().isOk());

        String ownerAToken = login("activity-owner-b@nforce.test");
        mockMvc.perform(get("/api/activity").header("Authorization", "Bearer " + ownerAToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].description").value("Completed Store B Only Task"))
            .andExpect(jsonPath("$[0].actorRole").value("EMPLOYEE"));

        String ownerBToken = login("activity-owner-c@nforce.test");
        mockMvc.perform(get("/api/activity").header("Authorization", "Bearer " + ownerBToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray())
            .andExpect(jsonPath("$", org.hamcrest.Matchers.not(
                org.hamcrest.Matchers.hasItem(
                    org.hamcrest.Matchers.hasEntry("description", "Completed Store B Only Task")))));
    }

    @Test
    @Transactional
    void ownerAdminDoesNotSeeTheirOwnAdminActionsOnlyTaskCompletions() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("activity-owner-d@nforce.test", ownerRole);
        User employee = user("activity-emp-d@nforce.test", empRole);
        Store store = store("Activity Store D");
        linkOwnerToStore(owner, store);
        StoreEmployee storeEmployee = storeEmployee(employee, store);
        Category category = category(store);
        Task task = task(category, store, "Store D Task");

        String ownerToken = login("activity-owner-d@nforce.test");

        // An admin action (employee update) must never surface in the owner's
        // own feed -- that feed is task-completions only.
        String body = objectMapper.writeValueAsString(new EmployeeUpdatePayload(
            "Updated Name", "activity-emp-d@nforce.test", "555-0199", "Part-time", "Other"));
        mockMvc.perform(put("/api/employees/{id}", storeEmployee.getId())
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/activity").header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray())
            .andExpect(jsonPath("$", org.hamcrest.Matchers.not(
                org.hamcrest.Matchers.hasItem(
                    org.hamcrest.Matchers.hasEntry("description", "Updated employee \"Updated Name\"")))));

        // But the employee's task completion does show up.
        String employeeToken = login("activity-emp-d@nforce.test");
        String responseBody = objectMapper.writeValueAsString(new TaskResponsePayload(store.getId(), true, null, null));
        mockMvc.perform(post("/api/me/tasks/{taskId}/responses", task.getId())
                .header("Authorization", "Bearer " + employeeToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(responseBody))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/activity").header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].description").value("Completed Store D Task"))
            .andExpect(jsonPath("$[0].actorRole").value("EMPLOYEE"));
    }

    private record LoginPayload(String email, String password) {}

    private record CategoryRequestPayload(String name, boolean appliesToAllStores, List<Long> storeIds) {}

    private record RaiseIssuePayload(Long storeId, String note) {}

    private record EmployeeUpdatePayload(
        String name, String email, String phone, String employeeType, String gender
    ) {}

    private record TaskResponsePayload(Long storeId, Boolean booleanValue, Double numericValue, String textValue) {}
}
