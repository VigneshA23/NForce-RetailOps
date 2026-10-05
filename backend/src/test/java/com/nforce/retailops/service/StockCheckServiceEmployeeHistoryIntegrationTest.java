package com.nforce.retailops.service;

import com.nforce.retailops.dto.StockCheckHistoryPageResponse;
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
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, 8, 0, employee, OffsetDateTime.now());
        check.recordSnapshot(StockCheckSnapshot.END_OF_DAY, 5, 0, employee, OffsetDateTime.now());
        stockCheckRepository.save(check);

        StockCheckHistoryPageResponse response = stockCheckService.listHistoricalChecksForEmployee(
            employee.getId(), store.getId(),
            LocalDate.of(2026, 7, 3), LocalDate.of(2026, 10, 2),
            1, 50
        );

        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).itemName()).isEqualTo("Integration Milk");
    }
}
