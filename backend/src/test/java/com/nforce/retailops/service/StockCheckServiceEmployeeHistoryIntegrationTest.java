package com.nforce.retailops.service;

import static com.nforce.retailops.TestDecimals.bd;
import com.nforce.retailops.dto.StockCheckHistoryPageResponse;
import com.nforce.retailops.dto.SuperAdminStockCheckHistoryPageResponse;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckReceipt;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StockCheckReceiptRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

// Exercises GET /api/me/inventory/stock-checks end to end against a real
// (H2, Postgres-compat) database -- real repositories, real
// UserProfileService.requireAssignedStore, real StockCheckResponse mapping --
// rather than StockCheckServiceTest's mocked userProfileService/repositories.
// Reported bug: this endpoint 500s for storeId=17, startDate=2026-07-03,
// endDate=2026-10-02 (a 92-day span, the widest the UI's "All time" range
// resolves to).
@SpringBootTest
@ActiveProfiles("test")
class StockCheckServiceEmployeeHistoryIntegrationTest {

    @Autowired private StockCheckService stockCheckService;
    @Autowired private StockReceiptService stockReceiptService;
    @Autowired private StoreInventoryItemService storeInventoryItemService;
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreEmployeeRepository storeEmployeeRepository;
    @Autowired private StoreInventoryItemRepository storeInventoryItemRepository;
    @Autowired private StockCheckRepository stockCheckRepository;
    @Autowired private StockCheckReceiptRepository stockCheckReceiptRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;

    private int seq = 0;

    @Test
    @Transactional
    void ninetyTwoDayWideRangeForAnAssignedEmployeeDoesNotThrow() {
        Store store = new Store();
        store.setName("Integration Store " + ++seq);
        store.setStoreCode(70_000L + seq);
        store.setActive(true);
        store = storeRepository.save(store);

        Role role = roleRepository.findByName("EMPLOYEE").orElseGet(() -> {
            Role r = new Role();
            r.setName("EMPLOYEE");
            r.setDescription("EMPLOYEE");
            return roleRepository.save(r);
        });

        User employee = new User();
        employee.setEmail("history-integration-" + seq + "@nforce.test");
        employee.setPasswordHash("irrelevant");
        employee.setFullName("History Integration Employee");
        employee.getRoles().add(role);
        employee = userRepository.save(employee);

        StoreEmployee assignment = new StoreEmployee();
        assignment.setEmployee(employee);
        assignment.getStores().add(store);
        assignment.setPhone("555-0100");
        assignment.setEmployeeType("FULL_TIME");
        assignment.setGender("UNSPECIFIED");
        storeEmployeeRepository.save(assignment);

        StoreInventoryItem item = new StoreInventoryItem();
        item.setStore(store);
        item.setName("Integration Milk");
        item.setUnitOfMeasurement("Gal");
        item.setActive(true);
        item = storeInventoryItemRepository.save(item);

        StockCheck check = new StockCheck();
        check.setStore(store);
        check.setStoreInventoryItem(item);
        check.setCheckDate(LocalDate.of(2026, 9, 1));
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(8), bd(0), employee, OffsetDateTime.now(), false);
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(5), bd(0), employee, OffsetDateTime.now(), false);
        stockCheckRepository.save(check);

        StockCheckHistoryPageResponse response = stockCheckService.listHistoricalChecksForEmployee(
            employee.getId(), store.getId(),
            LocalDate.of(2026, 7, 3), LocalDate.of(2026, 10, 2),
            1, 50, null
        );

        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).itemName()).isEqualTo("Integration Milk");
    }
    private StockCheck seedCheck(Store store, User by, String name, Integer min, Integer endOfDay) {
        StoreInventoryItem item = new StoreInventoryItem();
        item.setStore(store);
        item.setName(name);
        item.setUnitOfMeasurement("Gal");
        item.setActive(true);
        item.setMinWeekday(min == null ? null : bd(min));
        item = storeInventoryItemRepository.save(item);

        StockCheck check = new StockCheck();
        check.setStore(store);
        check.setStoreInventoryItem(item);
        check.setCheckDate(LocalDate.of(2026, 9, 1));
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(10), bd(0), by, OffsetDateTime.now(), false);
        if (endOfDay != null) {
            check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(endOfDay), bd(0), by, OffsetDateTime.now(), false);
        }
        return stockCheckRepository.save(check);
    }

    @Test
    @Transactional
    void statusFilterPagesTheWholeRangeAndCountsCoverEveryRecord() {
        Store store = new Store();
        store.setName("Status Filter Store " + ++seq);
        store.setStoreCode(71_000L + seq);
        store.setActive(true);
        store = storeRepository.save(store);

        User user = new User();
        user.setEmail("status-filter-" + seq + "@nforce.test");
        user.setPasswordHash("irrelevant");
        user.setFullName("Status Filter User");
        user = userRepository.save(user);

        seedCheck(store, user, "A Short", 10, 3);
        seedCheck(store, user, "B Enough", 5, 8);
        seedCheck(store, user, "C Uncounted", 5, null);
        seedCheck(store, user, "D Uncounted", 5, null);
        seedCheck(store, user, "E No Par", null, 4);

        LocalDate day = LocalDate.of(2026, 9, 1);
        SuperAdminStockCheckHistoryPageResponse secondPage = stockCheckService.listHistoricalChecksForSuperAdmin(
            store.getId(), day, day, 2, 1, "not_counted"
        );

        assertThat(secondPage.totalItems()).isEqualTo(3);
        assertThat(secondPage.pageCount()).isEqualTo(3);
        assertThat(secondPage.items()).hasSize(1);
        assertThat(secondPage.items().get(0).check().itemName()).isEqualTo("D Uncounted");
        assertThat(secondPage.statusCounts().all()).isEqualTo(5);
        assertThat(secondPage.statusCounts().shortage()).isEqualTo(1);
        assertThat(secondPage.statusCounts().sufficient()).isEqualTo(1);
        assertThat(secondPage.statusCounts().notCounted()).isEqualTo(3);

        SuperAdminStockCheckHistoryPageResponse shortage = stockCheckService.listHistoricalChecksForSuperAdmin(
            store.getId(), day, day, 1, 10, "shortage"
        );
        assertThat(shortage.items()).extracting(i -> i.check().itemName()).containsExactly("A Short");
        assertThat(shortage.statusCounts().all()).isEqualTo(5);

        SuperAdminStockCheckHistoryPageResponse unfiltered = stockCheckService.listHistoricalChecksForSuperAdmin(
            store.getId(), day, day, 1, 10, null
        );
        assertThat(unfiltered.totalItems()).isEqualTo(5);
    }

    @Test
    @Transactional
    void unknownStatusFilterIsRejected() {
        Store store = new Store();
        store.setName("Bad Status Store " + ++seq);
        store.setStoreCode(72_000L + seq);
        store.setActive(true);
        Store saved = storeRepository.save(store);
        LocalDate day = LocalDate.of(2026, 9, 1);

        org.assertj.core.api.Assertions.assertThatThrownBy(() ->
            stockCheckService.listHistoricalChecksForSuperAdmin(saved.getId(), day, day, 1, 10, "bogus")
        ).isInstanceOf(com.nforce.retailops.exception.InvalidStockCheckException.class);
    }
    @Test
    @Transactional
    void todaysChecklistReportsDeliveriesReceivedAfterEndOfDay() {
        Store store = new Store();
        store.setName("After EOD Store " + ++seq);
        store.setStoreCode(73_000L + seq);
        store.setActive(true);
        store = storeRepository.save(store);

        Role role = roleRepository.findByName("EMPLOYEE").orElseGet(() -> {
            Role r = new Role();
            r.setName("EMPLOYEE");
            r.setDescription("EMPLOYEE");
            return roleRepository.save(r);
        });
        User employee = new User();
        employee.setEmail("after-eod-" + seq + "@nforce.test");
        employee.setPasswordHash("irrelevant");
        employee.setFullName("After EOD Employee");
        employee.getRoles().add(role);
        employee = userRepository.save(employee);
        StoreEmployee assignment = new StoreEmployee();
        assignment.setEmployee(employee);
        assignment.getStores().add(store);
        assignment.setPhone("555-0101");
        assignment.setEmployeeType("FULL_TIME");
        assignment.setGender("UNSPECIFIED");
        storeEmployeeRepository.save(assignment);

        StoreInventoryItem strawberry = new StoreInventoryItem();
        strawberry.setStore(store);
        strawberry.setName("Strawberry");
        strawberry.setUnitOfMeasurement("kg");
        strawberry.setActive(true);
        strawberry.setMinWeekday(bd(9));
        strawberry.setMinWeekend(bd(9));
        strawberry = storeInventoryItemRepository.save(strawberry);

        StockCheck check = new StockCheck();
        check.setStore(store);
        check.setStoreInventoryItem(strawberry);
        check.setCheckDate(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(10), bd(0), employee, OffsetDateTime.now(), false);
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(4), bd(0), employee, OffsetDateTime.now(), false);
        stockCheckRepository.save(check);

        // 20 kg arrives after the closing count: kept beside it as a pending receipt.
        StockCheckReceipt delivery = new StockCheckReceipt();
        delivery.setStore(store);
        delivery.setStoreInventoryItem(strawberry);
        delivery.setQuantity(bd(20));
        delivery.setCountAfter(bd(24));
        delivery.setReceivedAt(OffsetDateTime.now().plusMinutes(5));
        stockCheckReceiptRepository.save(delivery);

        var items = stockCheckService.getTodayChecklist(employee.getId(), store.getId());

        assertThat(items).singleElement().satisfies(item -> {
            assertThat(item.endOfDay().usable()).isEqualByComparingTo(bd(4));
            assertThat(item.deliveredAfterEndOfDay()).isEqualByComparingTo(bd(20));
        });
    }
    @Test
    @Transactional
    void inventoryCountsJudgeTheStatusOnStockOnHandIncludingDeliveriesAfterEndOfDay() {
        Store store = new Store();
        store.setName("Detergent Store " + ++seq);
        store.setStoreCode(74_000L + seq);
        store.setActive(true);
        store = storeRepository.save(store);

        User user = new User();
        user.setEmail("detergent-" + seq + "@nforce.test");
        user.setPasswordHash("irrelevant");
        user.setFullName("Detergent User");
        user = userRepository.save(user);

        StoreInventoryItem detergent = new StoreInventoryItem();
        detergent.setStore(store);
        detergent.setName("Dishwashing Detergent");
        detergent.setUnitOfMeasurement("L");
        detergent.setActive(true);
        detergent.setMinWeekday(bd(5));
        detergent.setMinWeekend(bd(5));
        detergent = storeInventoryItemRepository.save(detergent);

        StockCheck check = new StockCheck();
        check.setStore(store);
        check.setStoreInventoryItem(detergent);
        check.setCheckDate(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(8), bd(0), user, OffsetDateTime.now(), false);
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(1), bd(0), user, OffsetDateTime.now(), false);
        stockCheckRepository.save(check);

        // 5 L delivered after the closing count: 1 + 5 = 6 on hand, above the minimum of 5.
        StockCheckReceipt delivery = new StockCheckReceipt();
        delivery.setStore(store);
        delivery.setStoreInventoryItem(detergent);
        delivery.setQuantity(bd(5));
        delivery.setCountAfter(bd(6));
        delivery.setReceivedAt(OffsetDateTime.now().plusMinutes(5));
        stockCheckReceiptRepository.save(delivery);

        var rows = stockCheckService.listInventoryCountsForSuperAdmin(store.getId(), null, null, null, 1, 50).rows();

        assertThat(rows).singleElement().satisfies(row -> {
            assertThat(row.currentStock()).isEqualByComparingTo(bd(6));
            assertThat(row.status()).isEqualTo(com.nforce.retailops.dto.InventoryCountStatus.HEALTHY);
        });
    }
    @Test
    @Transactional
    void aRestockAfterEndOfDayRaisesEveryViewOfTheStockOnHand() {
        Store store = new Store();
        store.setName("Restock After EOD Store " + ++seq);
        store.setStoreCode(75_000L + seq);
        store.setActive(true);
        store = storeRepository.save(store);

        Role role = roleRepository.findByName("EMPLOYEE").orElseGet(() -> {
            Role r = new Role();
            r.setName("EMPLOYEE");
            r.setDescription("EMPLOYEE");
            return roleRepository.save(r);
        });
        User employee = new User();
        employee.setEmail("restock-eod-" + seq + "@nforce.test");
        employee.setPasswordHash("irrelevant");
        employee.setFullName("Restock Employee");
        employee.getRoles().add(role);
        employee = userRepository.save(employee);
        StoreEmployee assignment = new StoreEmployee();
        assignment.setEmployee(employee);
        assignment.getStores().add(store);
        assignment.setPhone("555-0102");
        assignment.setEmployeeType("FULL_TIME");
        assignment.setGender("UNSPECIFIED");
        storeEmployeeRepository.save(assignment);

        StoreInventoryItem detergent = new StoreInventoryItem();
        detergent.setStore(store);
        detergent.setName("Dishwashing Detergent");
        detergent.setUnitOfMeasurement("L");
        detergent.setActive(true);
        detergent.setMinWeekday(bd(5));
        detergent.setMinWeekend(bd(5));
        detergent = storeInventoryItemRepository.save(detergent);

        StockCheck check = new StockCheck();
        check.setStore(store);
        check.setStoreInventoryItem(detergent);
        check.setCheckDate(LocalDate.now());
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(8), bd(0), employee, OffsetDateTime.now().minusHours(2), false);
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(1), bd(0), employee, OffsetDateTime.now().minusHours(1), false);
        stockCheckRepository.save(check);

        // The real path: an Ordered order marked Received after End of Day.
        var result = stockReceiptService.applyReceipt(detergent, bd(5), employee, null);
        assertThat(result.currentStock()).isEqualByComparingTo(bd(6));

        // Employee stock check card: End of Day 1 plus 5 delivered after it.
        var daily = stockCheckService.getTodayChecklist(employee.getId(), store.getId());
        assertThat(daily).singleElement().satisfies(item -> {
            assertThat(item.endOfDay().usable()).isEqualByComparingTo(bd(1));
            assertThat(item.deliveredAfterEndOfDay()).isEqualByComparingTo(bd(5));
        });

        // Inventory Counts: 6 on hand, healthy against a minimum of 5.
        var counts = stockCheckService.listInventoryCountsForSuperAdmin(store.getId(), null, null, null, 1, 50).rows();
        assertThat(counts).singleElement().satisfies(row -> {
            assertThat(row.currentStock()).isEqualByComparingTo(bd(6));
            assertThat(row.status()).isEqualTo(com.nforce.retailops.dto.InventoryCountStatus.HEALTHY);
        });

        // Inventory item card.
        Long storeId = store.getId();
        var cards = storeInventoryItemService.listAllForSuperAdmin().stream()
            .filter(c -> c.name().equals("Dishwashing Detergent") && c.storeId().equals(storeId))
            .toList();
        assertThat(cards).singleElement()
            .satisfies(card -> assertThat(card.currentAvailable()).isEqualByComparingTo(bd(6)));
    }
}
