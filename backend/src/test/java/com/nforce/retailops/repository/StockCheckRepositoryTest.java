package com.nforce.retailops.repository;

import com.nforce.retailops.entity.InventoryCategory;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckCorrection;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

// Proves findForStoreInRange's join shape (no inner join against "active" --
// a deactivated item's history must still show) and the correction
// repository's earliest/latest grouping against a real database. Both would
// still compile and pass a mocked StockCheckServiceTest with the wrong shape.
@SpringBootTest
@ActiveProfiles("test")
class StockCheckRepositoryTest {

    @Autowired private StockCheckRepository stockCheckRepository;
    @Autowired private StockCheckCorrectionRepository stockCheckCorrectionRepository;
    @Autowired private StoreInventoryItemRepository storeInventoryItemRepository;
    @Autowired private StoreRepository storeRepository;
    @Autowired private InventoryCategoryRepository inventoryCategoryRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private RoleRepository roleRepository;

    private int seq = 0;

    private Store store() {
        Store store = new Store();
        store.setName("Store " + ++seq);
        store.setStoreCode(9_000L + seq);
        store.setActive(true);
        return storeRepository.save(store);
    }

    private User employee(String email) {
        Role role = roleRepository.findByName("EMPLOYEE").orElseGet(() -> {
            Role r = new Role();
            r.setName("EMPLOYEE");
            r.setDescription("EMPLOYEE");
            return roleRepository.save(r);
        });
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("irrelevant");
        user.setFullName("Employee " + email);
        user.getRoles().add(role);
        return userRepository.save(user);
    }

    private StoreInventoryItem storeItem(Store store, boolean active) {
        InventoryCategory category = new InventoryCategory();
        category.setName("Category " + ++seq);
        category.setDisplayOrder(0);
        category.setActive(true);
        category = inventoryCategoryRepository.save(category);

        StoreInventoryItem sii = new StoreInventoryItem();
        sii.setStore(store);
        sii.setCategory(category);
        sii.setName("Item " + seq);
        sii.setUnitOfMeasurement("EA");
        sii.setActive(active);
        return storeInventoryItemRepository.save(sii);
    }

    private StockCheck check(StoreInventoryItem item, User checkedBy, LocalDate date, int count) {
        StockCheck check = new StockCheck();
        check.setStoreInventoryItem(item);
        check.setCheckedBy(checkedBy);
        check.setCheckDate(date);
        check.setCurrentCount(count);
        check.setQuantityNeeded(0);
        return stockCheckRepository.save(check);
    }

    @Test
    @Transactional
    void deactivatedItemsCheckStillAppearsInRange() {
        Store storeEntity = store();
        User recorder = employee("repo-deactivated@nforce.test");
        StoreInventoryItem deactivated = storeItem(storeEntity, false);
        check(deactivated, recorder, LocalDate.of(2026, 6, 15), 4);

        Page<StockCheck> page = stockCheckRepository.findForStoreInRange(
            storeEntity.getId(), LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30), PageRequest.of(0, 20));

        assertThat(page.getContent()).hasSize(1);
        assertThat(page.getContent().get(0).getCurrentCount()).isEqualTo(4);
    }

    @Test
    @Transactional
    void correctedCheckExposesEarliestOriginalAndLatestCorrector() {
        Store storeEntity = store();
        User recorder = employee("repo-corrected-recorder@nforce.test");
        User firstCorrector = employee("repo-corrected-first@nforce.test");
        User secondCorrector = employee("repo-corrected-second@nforce.test");
        StoreInventoryItem item = storeItem(storeEntity, true);
        StockCheck stockCheck = check(item, recorder, LocalDate.of(2026, 6, 15), 10);

        // correctedAt is set explicitly (not left to @PrePersist's
        // OffsetDateTime.now()) so ordering is deterministic -- two real
        // saves this close together can otherwise land in the same clock
        // tick and make earliest/latest resolution flaky. Same precedent as
        // OrderListEntryAggregateRepositoryTest.entryCreatedAt.
        StockCheckCorrection first = new StockCheckCorrection();
        first.setStockCheck(stockCheck);
        first.setOriginalCount(10);
        first.setCorrectedCount(7);
        first.setCorrectedBy(firstCorrector);
        stockCheckCorrectionRepository.saveAndFlush(first);
        ReflectionTestUtils.setField(first, "correctedAt", OffsetDateTime.now().minusMinutes(10));
        stockCheckCorrectionRepository.saveAndFlush(first);

        StockCheckCorrection second = new StockCheckCorrection();
        second.setStockCheck(stockCheck);
        second.setOriginalCount(7);
        second.setCorrectedCount(5);
        second.setCorrectedBy(secondCorrector);
        stockCheckCorrectionRepository.saveAndFlush(second);
        ReflectionTestUtils.setField(second, "correctedAt", OffsetDateTime.now());
        stockCheckCorrectionRepository.saveAndFlush(second);

        Map<Long, StockCheckCorrection> earliest =
            stockCheckCorrectionRepository.findEarliestByStockCheckIds(List.of(stockCheck.getId()));
        Map<Long, StockCheckCorrection> latest =
            stockCheckCorrectionRepository.findLatestByStockCheckIds(List.of(stockCheck.getId()));

        assertThat(earliest.get(stockCheck.getId()).getOriginalCount()).isEqualTo(10);
        assertThat(latest.get(stockCheck.getId()).getCorrectedBy().getEmail())
            .isEqualTo("repo-corrected-second@nforce.test");
    }

    @Test
    @Transactional
    void rangeBoundariesAreBothInclusive() {
        Store storeEntity = store();
        User recorder = employee("repo-boundary@nforce.test");
        StoreInventoryItem item = storeItem(storeEntity, true);
        check(item, recorder, LocalDate.of(2026, 6, 1), 1);
        check(item, recorder, LocalDate.of(2026, 6, 30), 2);
        check(item, recorder, LocalDate.of(2026, 5, 31), 99);
        check(item, recorder, LocalDate.of(2026, 7, 1), 99);

        Page<StockCheck> page = stockCheckRepository.findForStoreInRange(
            storeEntity.getId(), LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30), PageRequest.of(0, 20));

        assertThat(page.getContent()).extracting(StockCheck::getCurrentCount).containsExactlyInAnyOrder(1, 2);
    }
}
