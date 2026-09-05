package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.dto.AdminCorrectionRequest;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
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
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.NotificationRepository;
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
import java.util.concurrent.atomic.AtomicLong;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NotificationTriggerTest {

    private static final String PASSWORD = "trigger-test-secret";
    private static final AtomicLong STORE_CODE = new AtomicLong(99000);

    @Autowired private MockMvc mockMvc;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreOwnerRepository storeOwnerRepository;
    @Autowired private StoreEmployeeRepository storeEmployeeRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskResponseEntryRepository taskResponseEntryRepository;
    @Autowired private SuperAdminRepository superAdminRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private NotificationRepository notificationRepository;

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
        u.setFullName("Trigger Test User");
        u.getRoles().add(role);
        return userRepository.save(u);
    }

    private Store store() {
        Store s = new Store();
        s.setName("Trigger Store " + STORE_CODE.get());
        s.setStoreCode(STORE_CODE.getAndIncrement());
        s.setActive(true);
        return storeRepository.save(s);
    }

    private void linkOwner(User owner, Store store) {
        StoreOwner so = new StoreOwner();
        so.setOwner(owner);
        so.setStore(store);
        storeOwnerRepository.save(so);
    }

    private StoreEmployee linkEmployee(User employee, Store store) {
        StoreEmployee se = new StoreEmployee();
        se.setEmployee(employee);
        se.setPhone("555-0300");
        se.setShift("Morning");
        se.setEmployeeType("Full-time");
        se.setGender("Other");
        se.getStores().add(store);
        return storeEmployeeRepository.save(se);
    }

    private Category category(User owner) {
        Category c = new Category();
        c.setOwner(owner);
        c.setName("Trigger Cat " + STORE_CODE.get());
        c.setDisplayOrder(0);
        c.setActive(true);
        return categoryRepository.save(c);
    }

    private Task booleanTask(User owner, Category cat) {
        Task t = new Task();
        t.setOwner(owner);
        t.setCategory(cat);
        t.setName("Check freezer temp");
        t.setDisplayOrder(0);
        t.setAppliesToAllStores(true);
        t.setResponseType(ResponseType.YES_NO);
        t.setCompletionType(CompletionType.SINGLE);
        t.setScheduleType(ScheduleType.EVERY_DAY);
        t.setTimeMode(TimeMode.ANYTIME);
        t.setStartDate(LocalDate.now().minusDays(1));
        t.setActive(true);
        return taskRepository.save(t);
    }

    private TaskResponseEntry booleanResponse(Task task, Store store, User employee, boolean value) {
        TaskResponseEntry e = new TaskResponseEntry();
        e.setTask(task);
        e.setStore(store);
        e.setEmployee(employee);
        e.setResponseDate(LocalDate.now());
        e.setResponseType(ResponseType.YES_NO);
        e.setCompletionType(CompletionType.SINGLE);
        e.setValueBoolean(value);
        e.setActive(true);
        return taskResponseEntryRepository.save(e);
    }

    private SuperAdmin superAdmin(String email) {
        SuperAdmin sa = new SuperAdmin();
        sa.setEmail(email);
        sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
        sa.setName("Super Admin");
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
    void correctionCreatesNotificationForEmployee() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("trig-owner-a@nforce.test", ownerRole);
        User employee = user("trig-emp-a@nforce.test", empRole);
        Store store = store();
        linkOwner(owner, store);
        linkEmployee(employee, store);
        Category cat = category(owner);
        Task task = booleanTask(owner, cat);
        TaskResponseEntry response = booleanResponse(task, store, employee, false);

        String ownerToken = login("trig-owner-a@nforce.test");
        AdminCorrectionRequest req = new AdminCorrectionRequest(true, null, null, "Pressed wrong button");

        mockMvc.perform(patch("/api/checklist-history/responses/{id}/correct", response.getId())
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk());

        String empToken = login("trig-emp-a@nforce.test");
        mockMvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + empToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].category").value("CORRECTION_MADE"))
            .andExpect(jsonPath("$[0].read").value(false))
            .andExpect(jsonPath("$[0].message").value("Reason: Pressed wrong button"));
    }

    @Test
    @Transactional
    void storeDeactivationCreatesNotificationForOwner() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        User owner = user("trig-owner-b@nforce.test", ownerRole);
        Store store = store();
        linkOwner(owner, store);

        superAdmin("trig-superadmin-a@nforce.test");
        String superToken = login("trig-superadmin-a@nforce.test");

        mockMvc.perform(patch("/api/stores/{id}/status", store.getId())
                .header("Authorization", "Bearer " + superToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\": false}"))
            .andExpect(status().isOk());

        String ownerToken = login("trig-owner-b@nforce.test");
        mockMvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].category").value("STORE_DEACTIVATED"))
            .andExpect(jsonPath("$[0].read").value(false));
    }

    @Test
    @Transactional
    void taskCreationNotifiesStoreEmployees() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("trig-owner-c@nforce.test", ownerRole);
        User employee = user("trig-emp-c@nforce.test", empRole);
        Store store = store();
        linkOwner(owner, store);
        linkEmployee(employee, store);
        Category cat = category(owner);

        String ownerToken = login("trig-owner-c@nforce.test");
        String taskJson = """
            {"name":"Check freezer","categoryId":%d,"responseType":"YES_NO","completionType":"SINGLE",
             "scheduleType":"EVERY_DAY","timeMode":"ANYTIME","appliesToAllStores":true,
             "startDate":"%s","storeIds":[]}
            """.formatted(cat.getId(), java.time.LocalDate.now());

        mockMvc.perform(post("/api/tasks")
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(taskJson))
            .andExpect(status().isCreated());

        String empToken = login("trig-emp-c@nforce.test");
        mockMvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + empToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].category").value("TASK_ADDED"))
            .andExpect(jsonPath("$[0].linkPath").value("/checklist"))
            .andExpect(jsonPath("$[0].read").value(false));
    }

    @Test
    @Transactional
    void categoryCreationNotifiesStoreEmployees() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("trig-owner-d@nforce.test", ownerRole);
        User employee = user("trig-emp-d@nforce.test", empRole);
        Store store = store();
        linkOwner(owner, store);
        linkEmployee(employee, store);

        String ownerToken = login("trig-owner-d@nforce.test");
        mockMvc.perform(post("/api/categories")
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"New Category Trigger\"}"))
            .andExpect(status().isCreated());

        String empToken = login("trig-emp-d@nforce.test");
        mockMvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + empToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].category").value("CATEGORY_ADDED"))
            .andExpect(jsonPath("$[0].linkPath").value("/checklist"))
            .andExpect(jsonPath("$[0].read").value(false));
    }

    @Test
    @Transactional
    void employeeAssignmentNotifiesEmployeeAndAdmin() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("trig-owner-e@nforce.test", ownerRole);
        User employee = user("trig-emp-e@nforce.test", empRole);
        Store store = store();
        linkOwner(owner, store);
        StoreEmployee se = new StoreEmployee();
        se.setEmployee(employee);
        se.setPhone("555-0100");
        se.setShift("Morning");
        se.setEmployeeType("Full-time");
        se.setGender("Other");
        se = storeEmployeeRepository.save(se);

        String ownerToken = login("trig-owner-e@nforce.test");
        mockMvc.perform(post("/api/employees/{id}/assignment", se.getId())
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk());

        String empToken = login("trig-emp-e@nforce.test");
        mockMvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + empToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].category").value("EMPLOYEE_ASSIGNED"))
            .andExpect(jsonPath("$[0].linkPath").value("/checklist"));

        mockMvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].category").value("NEW_EMPLOYEE_JOINED"))
            .andExpect(jsonPath("$[0].linkPath").value("/employees"));
    }

    @Test
    @Transactional
    void employeeUnassignmentNotifiesEmployee() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("trig-owner-f@nforce.test", ownerRole);
        User employee = user("trig-emp-f@nforce.test", empRole);
        Store store = store();
        linkOwner(owner, store);
        StoreEmployee se = linkEmployee(employee, store);

        String ownerToken = login("trig-owner-f@nforce.test");
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .delete("/api/employees/{id}/assignment", se.getId())
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isOk());

        String empToken = login("trig-emp-f@nforce.test");
        mockMvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + empToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].category").value("EMPLOYEE_REMOVED"))
            .andExpect(jsonPath("$[0].read").value(false));
    }

    @Test
    @Transactional
    void employeeAccountDeactivationNotifiesEmployee() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("trig-owner-g@nforce.test", ownerRole);
        User employee = user("trig-emp-g@nforce.test", empRole);
        Store store = store();
        linkOwner(owner, store);
        StoreEmployee se = linkEmployee(employee, store);

        String ownerToken = login("trig-owner-g@nforce.test");
        mockMvc.perform(patch("/api/employees/{id}/status", se.getId())
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\": false}"))
            .andExpect(status().isOk());

        // Can't log in as deactivated employee — check the DB directly instead.
        var notifications = notificationRepository.findByRecipientUserIdOrderByCreatedAtDesc(
            employee.getId(), org.springframework.data.domain.PageRequest.of(0, 10));
        assertThat(notifications).hasSize(1);
        assertThat(notifications.get(0).getCategory()).isEqualTo("EMPLOYEE_ACCOUNT_DEACTIVATED");
        assertThat(notifications.get(0).isRead()).isFalse();
    }

    private record LoginPayload(String email, String password) {}
}
