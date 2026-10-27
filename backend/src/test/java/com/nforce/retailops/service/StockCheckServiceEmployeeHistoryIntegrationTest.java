package com.nforce.retailops.service;

import static com.nforce.retailops.TestDecimals.bd;
import com.nforce.retailops.dto.StockCheckHistoryPageResponse;
import com.nforce.retailops.dto.SuperAdminStockCheckHistoryPageResponse;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.RoleRepository;
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
    @Autowired private StoreRepository storeRepository;
    @Autowired private StoreEmployeeRepository storeEmployeeRepository;
    @Autowired private StoreInventoryItemRepository storeInventoryItemRepository;
    @Autowired private StockCheckRepository stockCheckRepository;
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
}
