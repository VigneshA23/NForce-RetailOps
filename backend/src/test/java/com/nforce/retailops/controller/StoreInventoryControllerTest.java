package com.nforce.retailops.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
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

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;

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
    @Autowired private StoreInventoryItemRepository storeInventoryItemRepository;
    @Autowired private StockCheckRepository stockCheckRepository;
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

    @Test
    @Transactional
    void inventoryListShowsTodaysRequiredMinimumAndTodaysCountedStock() throws Exception {
        User owner = owner("inventory-required-owner@nforce.test");
        Store store = store("Inventory Required Store", 9301L);
        linkOwnerToStore(owner, store);

        StoreInventoryItem counted = item(store, "Counted Milk", 8, 12);
        item(store, "Uncounted Bread", 5, null);

        LocalDate today = LocalDate.now();
        // Start of Day 10 (2 dead), End of Day 4 (1 dead): current available
        // is the latest snapshot's usable stock, 3.
        check(counted, owner, today, 10, 2, 4, 1);

        // Yesterday's count must not be reported as today's.
        check(storeInventoryItemRepository.findByStoreIdOrderById(store.getId()).get(1), owner, today.minusDays(1), 40, 0, null, null);

        boolean weekend = today.getDayOfWeek() == DayOfWeek.SATURDAY || today.getDayOfWeek() == DayOfWeek.SUNDAY;
        String token = login("inventory-required-owner@nforce.test");

        mockMvc.perform(get("/api/stores/inventory")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("Counted Milk"))
            .andExpect(jsonPath("$[0].requiredToday").value(weekend ? 12 : 8))
            .andExpect(jsonPath("$[0].currentAvailable").value(3))
            .andExpect(jsonPath("$[1].name").value("Uncounted Bread"))
            // No weekend minimum set, so the weekday one applies every day.
            .andExpect(jsonPath("$[1].requiredToday").value(5))
            .andExpect(jsonPath("$[1].currentAvailable").doesNotExist());
    }

    @Test
    @Transactional
    void eodReportGroupsBySupplierAndComputesUsageFromBothSnapshots() throws Exception {
        User owner = owner("inventory-eod-owner@nforce.test");
        Store store = store("Inventory EOD Store", 9302L);
        linkOwnerToStore(owner, store);

        StoreInventoryItem milk = item(store, "Milk", 40, 40);
        item(store, "Bread", 10, 10);
        LocalDate today = LocalDate.now();
        check(milk, owner, today, 50, 2, null, null);

        String token = login("inventory-eod-owner@nforce.test");

        // EOD not yet counted: usage and order quantity are unknown.
        mockMvc.perform(get("/api/stores/inventory/eod-report")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.groups[0].supplierName").value("No Supplier"))
            .andExpect(jsonPath("$.groups[0].items[1].itemName").value("Milk"))
            .andExpect(jsonPath("$.groups[0].items[1].status").value("END_OF_DAY_PENDING"))
            .andExpect(jsonPath("$.itemsPendingEndOfDay").value(2));

        StockCheck saved = stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(milk.getId(), today).orElseThrow();
        saved.recordSnapshot(StockCheckSnapshot.END_OF_DAY, 35, 1, owner, OffsetDateTime.now());
        saved.setRequiredTomorrow(40);
        saved.setQuantityNeeded(6);
        stockCheckRepository.save(saved);

        mockMvc.perform(get("/api/stores/inventory/eod-report")
                .header("Authorization", "Bearer " + token)
                .param("date", today.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.groups[0].items[1].startOfDayAvailable").value(50))
            .andExpect(jsonPath("$.groups[0].items[1].endOfDayAvailable").value(35))
            .andExpect(jsonPath("$.groups[0].items[1].stockUsed").value(14))
            .andExpect(jsonPath("$.groups[0].items[1].quantityToOrder").value(6))
            .andExpect(jsonPath("$.groups[0].items[1].status").value("NEEDS_TO_ORDER"))
            .andExpect(jsonPath("$.itemsNeedingOrder").value(1));
    }

    @Test
    @Transactional
    void inventoryCountsReportsStatusAndKpisAcrossActiveItems() throws Exception {
        User owner = owner("inventory-counts-owner@nforce.test");
        Store store = store("Inventory Counts Store", 9303L);
        linkOwnerToStore(owner, store);

        StoreInventoryItem milk = item(store, "Milk", 20, 20);
        item(store, "Bread", 5, 5);
        LocalDate today = LocalDate.now();
        check(milk, owner, today, 30, 0, null, null);
        check(storeInventoryItemRepository.findByStoreIdOrderById(store.getId()).get(1), owner, today.minusDays(1), 10, 0, null, null);

        String token = login("inventory-counts-owner@nforce.test");

        mockMvc.perform(get("/api/stores/inventory/counts")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.allCount").value(2))
            .andExpect(jsonPath("$.staleCount").value(1))
            .andExpect(jsonPath("$.rows[0].name").value("Milk"))
            .andExpect(jsonPath("$.rows[0].status").value("HEALTHY"))
            .andExpect(jsonPath("$.rows[0].currentStock").value(30))
            .andExpect(jsonPath("$.rows[1].name").value("Bread"))
            .andExpect(jsonPath("$.rows[1].status").value("STALE"));

        mockMvc.perform(get("/api/stores/inventory/counts")
                .header("Authorization", "Bearer " + token)
                .param("level", "stale"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.rows.length()").value(1))
            .andExpect(jsonPath("$.rows[0].name").value("Bread"));
    }

    @Test
    @Transactional
    void countHistoryEndpointReturnsNewestFirstWithDelta() throws Exception {
        User owner = owner("inventory-counts-history-owner@nforce.test");
        Store store = store("Inventory Counts History Store", 9304L);
        linkOwnerToStore(owner, store);

        StoreInventoryItem milk = item(store, "Milk", 20, 20);
        LocalDate today = LocalDate.now();
        check(milk, owner, today.minusDays(1), 24, 0, null, null);
        check(milk, owner, today, 30, 0, null, null);

        String token = login("inventory-counts-history-owner@nforce.test");

        mockMvc.perform(get("/api/stores/inventory/counts/" + milk.getId() + "/history")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].count").value(30))
            .andExpect(jsonPath("$[0].delta").value(6))
            .andExpect(jsonPath("$[1].count").value(24))
            .andExpect(jsonPath("$[1].delta").doesNotExist());
    }

    private void check(StoreInventoryItem item, User by, LocalDate date,
                       int sodAvailable, int sodDead, Integer eodAvailable, Integer eodDead) {
        StockCheck check = new StockCheck();
        check.setStore(item.getStore());
        check.setStoreInventoryItem(item);
        check.setCheckDate(date);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, sodAvailable, sodDead, by, OffsetDateTime.now());
        if (eodAvailable != null) {
            check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, eodAvailable, eodDead, by, OffsetDateTime.now());
        }
        stockCheckRepository.save(check);
    }

    private StoreInventoryItem item(Store store, String name, Integer minWeekday, Integer minWeekend) {
        StoreInventoryItem item = new StoreInventoryItem();
        item.setStore(store);
        item.setName(name);
        item.setUnitOfMeasurement("L");
        item.setMinWeekday(minWeekday);
        item.setMinWeekend(minWeekend);
        item.setActive(true);
        return storeInventoryItemRepository.save(item);
    }

    private record LoginPayload(String email, String password) {
    }
}
