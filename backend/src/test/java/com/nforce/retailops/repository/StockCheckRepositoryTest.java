package com.nforce.retailops.repository;

import static com.nforce.retailops.TestDecimals.bd;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckCorrection;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Proves findForStoreInRange's join shape (no inner join against "active" --
// a deactivated item's history must still show; left joins so a record with
// only one snapshot still loads), the one-record-per-store-item-day
// constraint, and the edit log's ordering against a real database. All of
// these would still pass a mocked StockCheckServiceTest with the wrong shape.
@SpringBootTest
@ActiveProfiles("test")
class StockCheckRepositoryTest {

    @Autowired private StockCheckRepository stockCheckRepository;
    @Autowired private StockCheckCorrectionRepository stockCheckCorrectionRepository;
    @Autowired private StoreInventoryItemRepository storeInventoryItemRepository;
    @Autowired private StoreRepository storeRepository;
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
        StoreInventoryItem sii = new StoreInventoryItem();
        sii.setStore(store);
        sii.setName("Item " + ++seq);
        sii.setUnitOfMeasurement("EA");
        sii.setActive(active);
        return storeInventoryItemRepository.save(sii);
    }

    private StockCheck newCheck(StoreInventoryItem item, LocalDate date) {
        StockCheck check = new StockCheck();
        check.setStore(item.getStore());
        check.setStoreInventoryItem(item);
        check.setCheckDate(date);
        return check;
    }

    private StockCheck startOfDay(StoreInventoryItem item, User by, LocalDate date, int available) {
        StockCheck check = newCheck(item, date);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, bd(available), bd(0), by, OffsetDateTime.now(), false);
        return stockCheckRepository.save(check);
    }

    @Test
    @Transactional
    void deactivatedItemsStartOnlyRecordStillAppearsInRange() {
        Store storeEntity = store();
        User recorder = employee("repo-deactivated@nforce.test");
        StoreInventoryItem deactivated = storeItem(storeEntity, false);
        startOfDay(deactivated, recorder, LocalDate.of(2026, 6, 15), 4);

        Page<StockCheck> page = stockCheckRepository.findForStoreInRange(
            storeEntity.getId(), LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30), PageRequest.of(0, 20));

        assertThat(page.getContent()).hasSize(1);
        StockCheck loaded = page.getContent().get(0);
        assertThat(loaded.getStartOfDayAvailable()).isEqualByComparingTo(bd(4));
        assertThat(loaded.getEndOfDayAvailable()).isNull();
        assertThat(loaded.getStartOfDayEnteredBy().getEmail()).isEqualTo("repo-deactivated@nforce.test");
    }

    @Test
    @Transactional
    void rangeBoundariesAreBothInclusive() {
        Store storeEntity = store();
        User recorder = employee("repo-boundary@nforce.test");
        StoreInventoryItem item = storeItem(storeEntity, true);
        startOfDay(item, recorder, LocalDate.of(2026, 6, 1), 1);
        startOfDay(item, recorder, LocalDate.of(2026, 6, 30), 2);
        startOfDay(item, recorder, LocalDate.of(2026, 5, 31), 99);
        startOfDay(item, recorder, LocalDate.of(2026, 7, 1), 99);

        Page<StockCheck> page = stockCheckRepository.findForStoreInRange(
            storeEntity.getId(), LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30), PageRequest.of(0, 20));

        assertThat(page.getContent()).extracting(StockCheck::getStartOfDayAvailable).usingElementComparator(java.math.BigDecimal::compareTo).containsExactlyInAnyOrder(bd(1), bd(2));
    }

    @Test
    @Transactional
    void aSecondRecordForTheSameStoreItemAndDayIsRejected() {
        Store storeEntity = store();
        User recorder = employee("repo-duplicate@nforce.test");
        StoreInventoryItem item = storeItem(storeEntity, true);
        LocalDate day = LocalDate.of(2026, 6, 15);
        startOfDay(item, recorder, day, 10);
        stockCheckRepository.flush();

        StockCheck duplicate = newCheck(item, day);
        duplicate.recordSnapshot(StockCheckSnapshot.END_OF_DAY, bd(5), bd(0), recorder, OffsetDateTime.now(), false);

        assertThatThrownBy(() -> stockCheckRepository.saveAndFlush(duplicate))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @Transactional
    void editLogComesBackOldestFirstWithEditors() {
        Store storeEntity = store();
        User recorder = employee("repo-edits-recorder@nforce.test");
        User firstEditor = employee("repo-edits-first@nforce.test");
        User secondEditor = employee("repo-edits-second@nforce.test");
        StoreInventoryItem item = storeItem(storeEntity, true);
        StockCheck stockCheck = startOfDay(item, recorder, LocalDate.of(2026, 6, 15), 10);

        // correctedAt is set explicitly (not left to @PrePersist's
        // OffsetDateTime.now()) so ordering is deterministic. Same precedent
        // as OrderListEntryAggregateRepositoryTest.entryCreatedAt.
        StockCheckCorrection second = edit(stockCheck, 7, 5, secondEditor, OffsetDateTime.now());
        StockCheckCorrection first = edit(stockCheck, 10, 7, firstEditor, OffsetDateTime.now().minusMinutes(10));

        List<StockCheckCorrection> edits =
            stockCheckCorrectionRepository.findWithEditorByStockCheckIds(List.of(stockCheck.getId()));

        assertThat(edits).extracting(StockCheckCorrection::getId).containsExactly(first.getId(), second.getId());
        assertThat(edits.get(0).getOriginalCount()).isEqualByComparingTo(bd(10));
        assertThat(edits.get(1).getCorrectedByUser().getEmail()).isEqualTo("repo-edits-second@nforce.test");
    }

    private StockCheckCorrection edit(StockCheck check, int from, int to, User by, OffsetDateTime at) {
        StockCheckCorrection correction = new StockCheckCorrection();
        correction.setStockCheck(check);
        correction.setSnapshot(StockCheckSnapshot.START_OF_DAY);
        correction.setOriginalCount(bd(from));
        correction.setOriginalDeadStock(bd(0));
        correction.setCorrectedCount(bd(to));
        correction.setCorrectedDeadStock(bd(0));
        correction.setCorrectedByUser(by);
        stockCheckCorrectionRepository.saveAndFlush(correction);
        ReflectionTestUtils.setField(correction, "correctedAt", at);
        return stockCheckCorrectionRepository.saveAndFlush(correction);
    }
}
