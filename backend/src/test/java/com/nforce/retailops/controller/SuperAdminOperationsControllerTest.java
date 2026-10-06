package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.OrderStatus;
import com.nforce.retailops.entity.RaisedIssue;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.RaisedIssueRepository;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.SupplierRepository;
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
import java.util.Map;

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
    @Autowired private StoreInventoryItemRepository storeInventoryItemRepository;
    @Autowired private OrderListEntryRepository orderListEntryRepository;
    @Autowired private SupplierRepository supplierRepository;
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

    private StoreInventoryItem inventoryItem(Store store, String name) {

        StoreInventoryItem item = new StoreInventoryItem();
        item.setStore(store);
        item.setName(name);
        item.setUnitOfMeasurement("L");
        item.setActive(true);
        return storeInventoryItemRepository.save(item);
    }

    private OrderListEntry orderEntry(Store store, StoreInventoryItem item, OrderStatus status) {
        OrderListEntry entry = new OrderListEntry();
        entry.setStore(store);
        entry.setStoreInventoryItem(item);
        entry.setQuantityNeeded(2);
        entry.setStatus(status);
        return orderListEntryRepository.save(entry);
    }

    private Supplier supplier(String name) {
        Supplier supplier = new Supplier();
        supplier.setName(name);
        return supplierRepository.save(supplier);
    }

    private OrderListEntry orderEntry(Store store, StoreInventoryItem item, OrderStatus status, Supplier supplier, int quantity) {
        OrderListEntry entry = new OrderListEntry();
        entry.setStore(store);
        entry.setStoreInventoryItem(item);
        entry.setQuantityNeeded(quantity);
        entry.setSupplier(supplier);
        entry.setStatus(status);
        return orderListEntryRepository.save(entry);
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

    // Dedicated coverage for the "Owners logged in today" Platform Health row:
    // two owners, only one of whom actually logs in during the test -- proves
    // the count reflects a real login (AuthService.login setting lastLoginAt),
    // not just owner existence, and that an owner who never logs in is
    // correctly excluded rather than defaulting to "counted".
    @Test
    @Transactional
    void platformStatsCountsOwnersLoggedInToday() throws Exception {
        superAdmin("sa-ops-admin-i@nforce.test");
        User ownerLoggedIn = ownerUser("sa-ops-owner-i-loggedin@nforce.test");
        User ownerNeverLoggedIn = ownerUser("sa-ops-owner-i-never@nforce.test");
        Store storeA = store("Store Owner Login A", 9230L);
        Store storeB = store("Store Owner Login B", 9231L);
        linkOwnerToStore(ownerLoggedIn, storeA);
        linkOwnerToStore(ownerNeverLoggedIn, storeB);

        login("sa-ops-owner-i-loggedin@nforce.test");

        String token = login("sa-ops-admin-i@nforce.test");

        mockMvc.perform(get("/api/super-admin/platform-stats")
                .header("Authorization", "Bearer " + token)
                .param("date", LocalDate.now().toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalOwners").value(2))
            .andExpect(jsonPath("$.ownersLoggedInToday").value(1));
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
            .andExpect(jsonPath("$.platformCompletionPercent").value(0))
            .andExpect(jsonPath("$.totalOwners").value(0))
            .andExpect(jsonPath("$.ownersLoggedInToday").value(0));
    }

    // The authority guard for the outstanding-orders endpoint. There is no
    // service-level check to test -- SuperAdminOperationsService takes no principal
    // and cannot deny anyone -- so the class-level @PreAuthorize is the guard, and
    // this is the only place it can be asserted.
    @Test
    @Transactional
    void outstandingOrdersRequiresSuperAdminRole() throws Exception {
        ownerUser("sa-ord-owner-a@nforce.test");
        String ownerToken = login("sa-ord-owner-a@nforce.test");

        mockMvc.perform(get("/api/super-admin/outstanding-orders")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void outstandingOrdersReturnsTotalAndPerStoreRows() throws Exception {
        superAdmin("sa-ord-admin-b@nforce.test");
        User owner = ownerUser("sa-ord-owner-b@nforce.test");
        Store storeB = store("Store Ordering", 9240L);
        linkOwnerToStore(owner, storeB);

        // Distinct items: V49's partial unique index forbids two non-RECEIVED
        // entries for the same store+item in production.
        orderEntry(storeB, inventoryItem(storeB, "Milk B"), OrderStatus.NEEDS_ORDERING);
        orderEntry(storeB, inventoryItem(storeB, "Bread B"), OrderStatus.NEEDS_ORDERING);

        String token = login("sa-ord-admin-b@nforce.test");

        // Filtered by store code rather than array index so the assertions stay
        // valid regardless of what else exists in the result.
        mockMvc.perform(get("/api/super-admin/outstanding-orders")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.platformOutstandingCount").isNumber())
            .andExpect(jsonPath("$.storesWithOutstanding").isNumber())
            .andExpect(jsonPath("$.truncated").value(false))
            .andExpect(jsonPath("$.stores").isArray())
            .andExpect(jsonPath("$.stores[?(@.storeCode == 9240)].outstandingCount").value(2))
            .andExpect(jsonPath("$.stores[?(@.storeCode == 9240)].ownerName").value("Test Owner"))
            .andExpect(jsonPath("$.stores[?(@.storeCode == 9240)].storeName").value("Store Ordering"))
            .andExpect(jsonPath("$.stores[?(@.storeCode == 9240)].oldestOutstandingAt").isNotEmpty());
    }

    // End-to-end proof that the query's left joins survive real SQL: a store with
    // no StoreOwner row at all must still appear.
    @Test
    @Transactional
    void outstandingOrdersRendersUnassignedOwnerName() throws Exception {
        superAdmin("sa-ord-admin-c@nforce.test");
        Store orphan = store("Store Unowned", 9241L);

        orderEntry(orphan, inventoryItem(orphan, "Milk C"), OrderStatus.NEEDS_ORDERING);

        String token = login("sa-ord-admin-c@nforce.test");

        mockMvc.perform(get("/api/super-admin/outstanding-orders")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.stores[?(@.storeCode == 9241)].ownerName").value("Unassigned"));
    }

    @Test
    @Transactional
    void outstandingOrdersOmitsStoresWithNothingOutstanding() throws Exception {
        superAdmin("sa-ord-admin-d@nforce.test");
        User owner = ownerUser("sa-ord-owner-d@nforce.test");
        Store settled = store("Store Settled", 9242L);
        linkOwnerToStore(owner, settled);

        orderEntry(settled, inventoryItem(settled, "Milk D"), OrderStatus.ORDERED);

        String token = login("sa-ord-admin-d@nforce.test");

        mockMvc.perform(get("/api/super-admin/outstanding-orders")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.stores[?(@.storeCode == 9242)]").isEmpty());
    }

    @Test
    @Transactional
    void supplierPurchaseMetricsRequiresSuperAdminRole() throws Exception {
        ownerUser("sa-spm-owner-a@nforce.test");
        String ownerToken = login("sa-spm-owner-a@nforce.test");

        mockMvc.perform(get("/api/super-admin/order-list/supplier-metrics")
                .param("fromDate", "2026-09-01")
                .param("toDate", "2026-09-04")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void supplierPurchaseMetricsBreaksDownEachStoreWithExactTotals() throws Exception {
        superAdmin("sa-spm-admin-b@nforce.test");
        Store storeOne = store("Store Purchasing One", 9250L);
        Store storeTwo = store("Store Purchasing Two", 9251L);
        Supplier supplierA = supplier("Supplier Purchasing A");

        orderEntry(storeOne, inventoryItem(storeOne, "Milk One"), OrderStatus.ORDERED, supplierA, 10);
        orderEntry(storeTwo, inventoryItem(storeTwo, "Milk Two"), OrderStatus.ORDERED, supplierA, 20);

        String token = login("sa-spm-admin-b@nforce.test");

        mockMvc.perform(get("/api/super-admin/order-list/supplier-metrics")
                .param("fromDate", LocalDate.now().minusDays(1).toString())
                .param("toDate", LocalDate.now().toString())
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.storeId == " + storeOne.getId() + ")].totalQuantity").value(10))
            .andExpect(jsonPath("$[?(@.storeId == " + storeTwo.getId() + ")].totalQuantity").value(20));
    }

    @Test
    @Transactional
    void supplierPurchaseMetricsExcludesNeedsOrderingEntries() throws Exception {
        superAdmin("sa-spm-admin-c@nforce.test");
        Store storeC = store("Store Purchasing Exclude", 9252L);
        Supplier supplierA = supplier("Supplier Purchasing Exclude A");

        orderEntry(storeC, inventoryItem(storeC, "Milk C"), OrderStatus.NEEDS_ORDERING, supplierA, 99);

        String token = login("sa-spm-admin-c@nforce.test");

        mockMvc.perform(get("/api/super-admin/order-list/supplier-metrics")
                .param("fromDate", LocalDate.now().minusDays(1).toString())
                .param("toDate", LocalDate.now().toString())
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.storeId == " + storeC.getId() + ")]").isEmpty());
    }

    @Test
    @Transactional
    void supplierPurchaseMetricsReturnsEmptyArrayWhenNothingQualifies() throws Exception {
        superAdmin("sa-spm-admin-d@nforce.test");
        String token = login("sa-spm-admin-d@nforce.test");

        mockMvc.perform(get("/api/super-admin/order-list/supplier-metrics")
                .param("fromDate", "2026-01-01")
                .param("toDate", "2026-01-02")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());
    }

    @Test
    @Transactional
    void supplierPurchaseMetricsExcludesEntriesOutsideTheDateRange() throws Exception {
        superAdmin("sa-spm-admin-e@nforce.test");
        Store storeE = store("Store Purchasing Dates", 9253L);
        Supplier supplierA = supplier("Supplier Purchasing Dates A");

        orderEntry(storeE, inventoryItem(storeE, "Milk E"), OrderStatus.ORDERED, supplierA, 5);

        String token = login("sa-spm-admin-e@nforce.test");

        // The only entry was just created (createdAt = now); a range entirely
        // in the past must not include it.
        mockMvc.perform(get("/api/super-admin/order-list/supplier-metrics")
                .param("fromDate", LocalDate.now().minusDays(10).toString())
                .param("toDate", LocalDate.now().minusDays(5).toString())
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.storeId == " + storeE.getId() + ")]").isEmpty());
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

    // ---- Super Admin cross-store order-list drill-down and status update ----

    @Test
    @Transactional
    void getOrderListForStoreRequiresSuperAdminRole() throws Exception {
        User owner = ownerUser("sa-orl-owner-a@nforce.test");
        Store store = store("Store Order List A", 9260L);
        linkOwnerToStore(owner, store);
        String ownerToken = login("sa-orl-owner-a@nforce.test");

        mockMvc.perform(get("/api/super-admin/stores/" + store.getId() + "/order-list")
                .header("Authorization", "Bearer " + ownerToken))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void getOrderListForStoreReturnsThatStoresEntries() throws Exception {
        superAdmin("sa-orl-admin-b@nforce.test");
        User owner = ownerUser("sa-orl-owner-b@nforce.test");
        Store store = store("Store Order List B", 9261L);
        linkOwnerToStore(owner, store);
        orderEntry(store, inventoryItem(store, "Milk Order List B"), OrderStatus.NEEDS_ORDERING);

        String token = login("sa-orl-admin-b@nforce.test");

        mockMvc.perform(get("/api/super-admin/stores/" + store.getId() + "/order-list")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].itemName").value("Milk Order List B"))
            .andExpect(jsonPath("$[0].status").value("NEEDS_ORDERING"));
    }

    @Test
    @Transactional
    void updateOrderStatusRequiresSuperAdminRole() throws Exception {
        User owner = ownerUser("sa-orl-owner-c@nforce.test");
        Store store = store("Store Order List C", 9262L);
        linkOwnerToStore(owner, store);
        OrderListEntry entry = orderEntry(store, inventoryItem(store, "Milk Order List C"), OrderStatus.NEEDS_ORDERING);
        String ownerToken = login("sa-orl-owner-c@nforce.test");

        String body = objectMapper.writeValueAsString(Map.of("status", "ORDERED"));

        mockMvc.perform(patch("/api/super-admin/stores/" + store.getId() + "/order-list/" + entry.getId() + "/status")
                .header("Authorization", "Bearer " + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isForbidden());
    }

    @Test
    @Transactional
    void updateOrderStatusAllowsTheSingleLegalForwardStep() throws Exception {
        superAdmin("sa-orl-admin-d@nforce.test");
        Store store = store("Store Order List D", 9263L);
        OrderListEntry entry = orderEntry(store, inventoryItem(store, "Milk Order List D"), OrderStatus.NEEDS_ORDERING);

        String token = login("sa-orl-admin-d@nforce.test");
        String body = objectMapper.writeValueAsString(Map.of("status", "ORDERED"));

        mockMvc.perform(patch("/api/super-admin/stores/" + store.getId() + "/order-list/" + entry.getId() + "/status")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ORDERED"));
    }

    @Test
    @Transactional
    void updateOrderStatusRejectsSkippingOrderedOnTheWayToReceived() throws Exception {
        superAdmin("sa-orl-admin-e@nforce.test");
        Store store = store("Store Order List E", 9264L);
        OrderListEntry entry = orderEntry(store, inventoryItem(store, "Milk Order List E"), OrderStatus.NEEDS_ORDERING);

        String token = login("sa-orl-admin-e@nforce.test");
        String body = objectMapper.writeValueAsString(Map.of("status", "RECEIVED"));

        mockMvc.perform(patch("/api/super-admin/stores/" + store.getId() + "/order-list/" + entry.getId() + "/status")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isConflict());
    }

    // The storeId in the path must match the entry's own store -- a Super Admin
    // (or a stale UI) pointing a valid entryId at the wrong store 404s exactly
    // like an Owner/Admin's cross-store access already does (findByIdAndStoreId).
    @Test
    @Transactional
    void updateOrderStatusReturnsNotFoundWhenEntryBelongsToAnotherStore() throws Exception {
        superAdmin("sa-orl-admin-f@nforce.test");
        Store storeF = store("Store Order List F", 9265L);
        Store otherStore = store("Store Order List F Other", 9266L);
        OrderListEntry entry = orderEntry(storeF, inventoryItem(storeF, "Milk Order List F"), OrderStatus.NEEDS_ORDERING);

        String token = login("sa-orl-admin-f@nforce.test");
        String body = objectMapper.writeValueAsString(Map.of("status", "ORDERED"));

        mockMvc.perform(patch("/api/super-admin/stores/" + otherStore.getId() + "/order-list/" + entry.getId() + "/status")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isNotFound());
    }

    record LoginPayload(String email, String password) {}
}
