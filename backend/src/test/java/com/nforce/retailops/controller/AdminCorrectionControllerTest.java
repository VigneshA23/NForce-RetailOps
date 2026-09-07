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
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.repository.CategoryRepository;
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
class AdminCorrectionControllerTest {

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
    @Autowired private SuperAdminRepository superAdminRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private static final java.util.concurrent.atomic.AtomicLong STORE_CODE = new java.util.concurrent.atomic.AtomicLong(88000);

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
        u.setFullName("Test User");
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

    private Task booleanTask(User owner, Category cat) {
        Task t = new Task();
        t.setOwner(owner);
        t.setCategory(cat);
        t.setName("Open safe");
        t.setDisplayOrder(0);
        t.setAppliesToAllStores(true);
        t.setResponseType(ResponseType.DONE_NOT_DONE);
        t.setCompletionType(CompletionType.SINGLE);
        t.setScheduleType(ScheduleType.EVERY_DAY);
        t.setTimeMode(TimeMode.ANYTIME);
        t.setStartDate(LocalDate.now().minusDays(1));
        t.setActive(true);
        return taskRepository.save(t);
    }

    private Category category(User owner) {
        Category c = new Category();
        c.setOwner(owner);
        c.setName("Opening");
        c.setDisplayOrder(0);
        c.setActive(true);
        return categoryRepository.save(c);
    }

    private TaskResponseEntry booleanResponse(Task task, Store store, User employee, boolean value) {
        TaskResponseEntry e = new TaskResponseEntry();
        e.setTask(task);
        e.setStore(store);
        e.setEmployee(employee);
        e.setResponseDate(LocalDate.now());
        e.setResponseType(ResponseType.DONE_NOT_DONE);
        e.setCompletionType(CompletionType.SINGLE);
        e.setValueBoolean(value);
        e.setActive(true);
        return taskResponseEntryRepository.save(e);
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
    void ownerCanCorrectResponseInOwnStore() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("corr-owner-a@nforce.test", ownerRole);
        User employee = user("corr-emp-a@nforce.test", empRole);
        Store store = store("Corr Store A");
        linkOwnerToStore(owner, store);
        Category cat = category(owner);
        Task task = booleanTask(owner, cat);
        storeEmployee(employee, store);
        TaskResponseEntry response = booleanResponse(task, store, employee, false);

        String token = login("corr-owner-a@nforce.test");
        AdminCorrectionRequest req = new AdminCorrectionRequest(true, null, null, "Employee pressed wrong button");

        mockMvc.perform(patch("/api/checklist-history/responses/{id}/correct", response.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.updatedResponse.booleanValue").value(true))
            .andExpect(jsonPath("$.correction.originalValueBoolean").value(false))
            .andExpect(jsonPath("$.correction.correctedValueBoolean").value(true))
            .andExpect(jsonPath("$.correction.reason").value("Employee pressed wrong button"));
    }

    @Test
    @Transactional
    void correctionHistoryIsReturnedInDescendingOrder() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("corr-owner-b@nforce.test", ownerRole);
        User employee = user("corr-emp-b@nforce.test", empRole);
        Store store = store("Corr Store B");
        linkOwnerToStore(owner, store);
        Category cat = category(owner);
        Task task = booleanTask(owner, cat);
        storeEmployee(employee, store);
        TaskResponseEntry response = booleanResponse(task, store, employee, false);

        String token = login("corr-owner-b@nforce.test");

        // First correction
        mockMvc.perform(patch("/api/checklist-history/responses/{id}/correct", response.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AdminCorrectionRequest(true, null, null, "First fix"))))
            .andExpect(status().isOk());

        // Second correction
        mockMvc.perform(patch("/api/checklist-history/responses/{id}/correct", response.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AdminCorrectionRequest(false, null, null, "Second fix"))))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/checklist-history/responses/{id}/corrections", response.getId())
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].reason").value("Second fix"));
    }

    @Test
    @Transactional
    void invalidCorrectedValueIsRejected() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("corr-owner-c@nforce.test", ownerRole);
        User employee = user("corr-emp-c@nforce.test", empRole);
        Store store = store("Corr Store C");
        linkOwnerToStore(owner, store);
        Category cat = category(owner);
        Task task = booleanTask(owner, cat);
        storeEmployee(employee, store);
        TaskResponseEntry response = booleanResponse(task, store, employee, false);

        String token = login("corr-owner-c@nforce.test");
        // boolean task but numeric value provided — boolean is null → 400
        AdminCorrectionRequest req = new AdminCorrectionRequest(null, 42.0, null, null);

        mockMvc.perform(patch("/api/checklist-history/responses/{id}/correct", response.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isBadRequest());
    }

    @Test
    @Transactional
    void ownerCannotCorrectResponseBelongingToDifferentStore() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");

        // ownerA owns storeA; ownerB owns storeB with a response
        User ownerA = user("corr-owner-d@nforce.test", ownerRole);
        User ownerB = user("corr-owner-e@nforce.test", ownerRole);
        User employee = user("corr-emp-e@nforce.test", empRole);

        Store storeA = store("Corr Store D");
        Store storeB = store("Corr Store E");
        linkOwnerToStore(ownerA, storeA);
        linkOwnerToStore(ownerB, storeB);

        Category cat = category(ownerB);
        Task task = booleanTask(ownerB, cat);
        storeEmployee(employee, storeB);
        TaskResponseEntry response = booleanResponse(task, storeB, employee, false);

        String tokenA = login("corr-owner-d@nforce.test");
        AdminCorrectionRequest req = new AdminCorrectionRequest(true, null, null, null);

        mockMvc.perform(patch("/api/checklist-history/responses/{id}/correct", response.getId())
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void nonexistentResponseReturns404() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        User owner = user("corr-owner-f@nforce.test", ownerRole);
        Store store = store("Corr Store F");
        linkOwnerToStore(owner, store);

        String token = login("corr-owner-f@nforce.test");
        AdminCorrectionRequest req = new AdminCorrectionRequest(true, null, null, null);

        mockMvc.perform(patch("/api/checklist-history/responses/{id}/correct", Long.MAX_VALUE)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void employeeRoleCannotAccessCorrectionEndpoints() throws Exception {
        Role empRole = role("EMPLOYEE");
        user("corr-emp-g@nforce.test", empRole);
        String token = login("corr-emp-g@nforce.test");

        mockMvc.perform(patch("/api/checklist-history/responses/1/correct")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/checklist-history/responses/1/corrections")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    // --- Flag-back-to-employee tests ---

    @Test
    @Transactional
    void ownerCanFlagResponseBackToEmployee() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("flag-owner-a@nforce.test", ownerRole);
        User employee = user("flag-emp-a@nforce.test", empRole);
        Store store = store("Flag Store A");
        linkOwnerToStore(owner, store);
        Category cat = category(owner);
        Task task = booleanTask(owner, cat);
        storeEmployee(employee, store);
        TaskResponseEntry response = booleanResponse(task, store, employee, true);

        String token = login("flag-owner-a@nforce.test");

        mockMvc.perform(post("/api/checklist-history/responses/{id}/flag", response.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Please re-check — counter was still dirty\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.flaggedNeedsCorrection").value(true))
            .andExpect(jsonPath("$.flagReason").value("Please re-check — counter was still dirty"))
            .andExpect(jsonPath("$.latestCorrection.correctionType").value("FLAG_TO_EMPLOYEE"))
            .andExpect(jsonPath("$.latestCorrection.reason").value("Please re-check — counter was still dirty"));
    }

    @Test
    @Transactional
    void flagWithoutReasonIsRejected() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("flag-owner-b@nforce.test", ownerRole);
        User employee = user("flag-emp-b@nforce.test", empRole);
        Store store = store("Flag Store B");
        linkOwnerToStore(owner, store);
        Category cat = category(owner);
        Task task = booleanTask(owner, cat);
        storeEmployee(employee, store);
        TaskResponseEntry response = booleanResponse(task, store, employee, true);

        String token = login("flag-owner-b@nforce.test");

        mockMvc.perform(post("/api/checklist-history/responses/{id}/flag", response.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"  \"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    @Transactional
    void ownerCannotFlagResponseBelongingToDifferentStore() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User ownerA = user("flag-owner-c@nforce.test", ownerRole);
        User ownerB = user("flag-owner-d@nforce.test", ownerRole);
        User employee = user("flag-emp-c@nforce.test", empRole);

        Store storeA = store("Flag Store C");
        Store storeB = store("Flag Store D");
        linkOwnerToStore(ownerA, storeA);
        linkOwnerToStore(ownerB, storeB);

        Category cat = category(ownerB);
        Task task = booleanTask(ownerB, cat);
        storeEmployee(employee, storeB);
        TaskResponseEntry response = booleanResponse(task, storeB, employee, true);

        String tokenA = login("flag-owner-c@nforce.test");

        mockMvc.perform(post("/api/checklist-history/responses/{id}/flag", response.getId())
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Wrong answer\"}"))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void employeeCannotAccessFlagEndpoint() throws Exception {
        Role empRole = role("EMPLOYEE");
        user("flag-emp-d@nforce.test", empRole);
        String token = login("flag-emp-d@nforce.test");

        mockMvc.perform(post("/api/checklist-history/responses/1/flag")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"test\"}"))
            .andExpect(status().isForbidden());
    }

    private SuperAdmin superAdmin(String email) {
        SuperAdmin sa = new SuperAdmin();
        sa.setName("Test Super Admin");
        sa.setEmail(email);
        sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
        return superAdminRepository.save(sa);
    }

    private String loginSuperAdmin(String email) throws Exception {
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
    void superAdminCanCorrectResponseInAnyStore() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("sa-corr-owner-a@nforce.test", ownerRole);
        User employee = user("sa-corr-emp-a@nforce.test", empRole);
        Store store = store("SA Corr Store A");
        linkOwnerToStore(owner, store);
        Category cat = category(owner);
        Task task = booleanTask(owner, cat);
        storeEmployee(employee, store);
        TaskResponseEntry response = booleanResponse(task, store, employee, false);

        superAdmin("sa-corr-a@nforce.test");
        String token = loginSuperAdmin("sa-corr-a@nforce.test");
        AdminCorrectionRequest req = new AdminCorrectionRequest(true, null, null, "Super admin override");

        mockMvc.perform(patch("/api/checklist-history/responses/{id}/correct", response.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.updatedResponse.booleanValue").value(true))
            .andExpect(jsonPath("$.correction.correctedByFullName").value("Test Super Admin"))
            .andExpect(jsonPath("$.correction.reason").value("Super admin override"));
    }

    @Test
    @Transactional
    void superAdminCanFlagResponseInAnyStore() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        Role empRole = role("EMPLOYEE");
        User owner = user("sa-flag-owner-a@nforce.test", ownerRole);
        User employee = user("sa-flag-emp-a@nforce.test", empRole);
        Store store = store("SA Flag Store A");
        linkOwnerToStore(owner, store);
        Category cat = category(owner);
        Task task = booleanTask(owner, cat);
        storeEmployee(employee, store);
        TaskResponseEntry response = booleanResponse(task, store, employee, true);

        superAdmin("sa-flag-a@nforce.test");
        String token = loginSuperAdmin("sa-flag-a@nforce.test");

        mockMvc.perform(post("/api/checklist-history/responses/{id}/flag", response.getId())
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Super admin: re-check this\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.flaggedNeedsCorrection").value(true))
            .andExpect(jsonPath("$.latestCorrection.correctionType").value("FLAG_TO_EMPLOYEE"))
            .andExpect(jsonPath("$.latestCorrection.correctedByFullName").value("Test Super Admin"));
    }

    private record LoginPayload(String email, String password) {}
}
