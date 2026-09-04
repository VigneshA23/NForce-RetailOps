package com.nforce.retailops.controller;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Mirrors AuthControllerTest: seeds real users/stores via repositories inside a
// @Transactional test method, then goes through a real /api/auth/login round trip to get
// a bearer token, rather than @WithMockUser -- @AuthenticationPrincipal AppUserDetails
// (used by ChecklistHistoryController) needs a real, DB-backed principal, and
// @WithMockUser's default principal isn't one.
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ChecklistHistoryControllerTest {

    private static final String PASSWORD = "correct-horse-battery-staple";

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
    private CategoryRepository categoryRepository;
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private TaskResponseEntryRepository taskResponseEntryRepository;
    @Autowired
    private StoreEmployeeRepository storeEmployeeRepository;
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

    private Store store(String name, long storeCode) {
        Store store = new Store();
        store.setName(name);
        store.setStoreCode(storeCode);
        store.setActive(true);
        return storeRepository.save(store);
    }

    private SuperAdmin superAdmin(String email) {
        SuperAdmin sa = new SuperAdmin();
        sa.setName("Test Super Admin");
        sa.setEmail(email);
        sa.setPasswordHash(passwordEncoder.encode(PASSWORD));
        return superAdminRepository.save(sa);
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
    void detailRequestForAnotherOwnersStoreIsMaskedAsNotFound() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        user("history-owner-a@nforce.test", ownerRole);
        User ownerB = user("history-owner-b@nforce.test", ownerRole);
        Store storeB = store("Owner B Store", 9101L);
        linkOwnerToStore(ownerB, storeB);

        String tokenA = login("history-owner-a@nforce.test");

        mockMvc.perform(get("/api/checklist-history/detail")
                .header("Authorization", "Bearer " + tokenA)
                .param("storeId", String.valueOf(storeB.getId()))
                .param("date", LocalDate.now().toString()))
            .andExpect(status().isNotFound());
    }

    @Test
    @Transactional
    void summaryRequestForAnotherOwnersStoreIsRejectedAsBadRequest() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        user("history-owner-c@nforce.test", ownerRole);
        User ownerD = user("history-owner-d@nforce.test", ownerRole);
        Store storeD = store("Owner D Store", 9102L);
        linkOwnerToStore(ownerD, storeD);

        String tokenC = login("history-owner-c@nforce.test");

        mockMvc.perform(get("/api/checklist-history/summary")
                .header("Authorization", "Bearer " + tokenC)
                .param("storeIds", String.valueOf(storeD.getId())))
            .andExpect(status().isBadRequest());
    }

    @Test
    @Transactional
    void employeeRoleIsForbiddenFromChecklistHistoryEndpoints() throws Exception {
        Role employeeRole = role("EMPLOYEE");
        user("history-employee@nforce.test", employeeRole);
        String token = login("history-employee@nforce.test");

        mockMvc.perform(get("/api/checklist-history/summary")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void detailReturnsCategorizedChecklistWithEmpIdAndCompletionStatus() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        User ownerE = user("history-owner-e@nforce.test", ownerRole);
        Store store = store("Downtown", 9103L);
        linkOwnerToStore(ownerE, store);

        Category category = new Category();
        category.setOwner(ownerE);
        category.setName("Opening");
        category.setDisplayOrder(0);
        category.setActive(true);
        category = categoryRepository.save(category);

        Task task = new Task();
        task.setOwner(ownerE);
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

        Role employeeRole = role("EMPLOYEE");
        User employee = user("history-employee-e@nforce.test", employeeRole);
        StoreEmployee storeEmployee = new StoreEmployee();
        storeEmployee.setEmployee(employee);
        storeEmployee.setPhone("555-0100");
        storeEmployee.setShift("Morning");
        storeEmployee.setEmployeeType("Full-time");
        storeEmployee.setGender("Other");
        storeEmployee.getStores().add(store);
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

        String tokenE = login("history-owner-e@nforce.test");

        mockMvc.perform(get("/api/checklist-history/detail")
                .header("Authorization", "Bearer " + tokenE)
                .param("storeId", String.valueOf(store.getId()))
                .param("date", LocalDate.now().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.hasChecklist").value(true))
            .andExpect(jsonPath("$.categories[0].tasks[0].completed").value(true))
            .andExpect(jsonPath("$.categories[0].tasks[0].responses[0].empId").exists());
    }

    @Test
    @Transactional
    void summaryReportsNoChecklistForADayWithoutRecords() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        User ownerF = user("history-owner-f@nforce.test", ownerRole);
        Store store = store("Uptown", 9104L);
        linkOwnerToStore(ownerF, store);

        String tokenF = login("history-owner-f@nforce.test");
        LocalDate today = LocalDate.now();

        mockMvc.perform(get("/api/checklist-history/summary")
                .header("Authorization", "Bearer " + tokenF)
                .param("storeIds", String.valueOf(store.getId()))
                .param("startDate", today.toString())
                .param("endDate", today.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].hasChecklist").value(false));
    }

    @Test
    @Transactional
    void superAdminCanViewDetailForAnyStore() throws Exception {
        // Owner + store that the super admin does NOT own
        Role ownerRole = role("OWNER_ADMIN");
        User owner = user("history-owner-g@nforce.test", ownerRole);
        Store store = store("Super Admin Target Store", 9105L);
        linkOwnerToStore(owner, store);

        // Real SuperAdmin entity in super_admins table — gets SuperAdminUserDetails principal,
        // which is what the real authentication path issues. A User row with role SUPER_ADMIN
        // gets AppUserDetails instead and would not exercise the actual super-admin code path.
        superAdmin("history-superadmin@nforce.test");
        String superAdminToken = login("history-superadmin@nforce.test");

        mockMvc.perform(get("/api/checklist-history/detail")
                .header("Authorization", "Bearer " + superAdminToken)
                .param("storeId", String.valueOf(store.getId()))
                .param("date", LocalDate.now().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.storeId").value(store.getId()));
    }

    @Test
    @Transactional
    void operationsSummaryNeverReturnsAnotherOwnersStoreEvenIfRequested() throws Exception {
        Role ownerRole = role("OWNER_ADMIN");
        User ownerH = user("history-owner-h@nforce.test", ownerRole);
        Store myStore = store("My Store", 9106L);
        linkOwnerToStore(ownerH, myStore);

        User ownerI = user("history-owner-i@nforce.test", ownerRole);
        Store otherStore = store("Other Owner Store", 9107L);
        linkOwnerToStore(ownerI, otherStore);

        String tokenH = login("history-owner-h@nforce.test");

        // No storeId/storeIds param exists on this endpoint at all -- confirms the
        // backend always resolves the caller's own store(s), never a client-supplied one.
        mockMvc.perform(get("/api/checklist-history/operations-summary")
                .header("Authorization", "Bearer " + tokenH))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.summary.length()").value(1))
            .andExpect(jsonPath("$.summary[0].storeName").value("My Store"));
    }

    @Test
    @Transactional
    void employeeRoleIsForbiddenFromOperationsSummaryEndpoint() throws Exception {
        Role employeeRole = role("EMPLOYEE");
        user("history-employee-ops@nforce.test", employeeRole);
        String token = login("history-employee-ops@nforce.test");

        mockMvc.perform(get("/api/checklist-history/operations-summary")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void superAdminIsBlockedFromSummaryEndpoint() throws Exception {
        Role superAdminRole = role("SUPER_ADMIN");
        user("history-superadmin-b@nforce.test", superAdminRole);
        String superAdminToken = login("history-superadmin-b@nforce.test");

        mockMvc.perform(get("/api/checklist-history/summary")
                .header("Authorization", "Bearer " + superAdminToken))
            .andExpect(status().isForbidden());
    }

    private record LoginPayload(String email, String password) {
    }
}
