package com.nforce.retailops.repository;

import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.util.ItemNames;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

// RTS-583: proves the duplicate-name queries' NAME_KEY expression against a
// real database -- a mocked service test can't tell whether the stored name
// is actually stripped of spaces and lower-cased in SQL.
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class StoreInventoryItemNameKeyRepositoryTest {

    @Autowired private StoreInventoryItemRepository storeInventoryItemRepository;
    @Autowired private StoreRepository storeRepository;

    private int seq = 0;

    private Store store() {
        Store store = new Store();
        store.setName("Name Key Store " + ++seq);
        store.setStoreCode(8_500L + seq);
        store.setActive(true);
        return storeRepository.save(store);
    }

    private StoreInventoryItem item(Store store, String name) {
        StoreInventoryItem item = new StoreInventoryItem();
        item.setStore(store);
        item.setName(name);
        item.setUnitOfMeasurement("EA");
        item.setActive(true);
        return storeInventoryItemRepository.save(item);
    }

    @Test
    void treatsSpacingAndCaseVariantsOfANameAsTheSameItemInAStore() {
        Store store = store();
        item(store, "Vanilla Syrup");

        assertThat(storeInventoryItemRepository.existsByStoreIdAndNameKey(store.getId(), ItemNames.duplicateKey("VanillaSyrup"))).isTrue();
        assertThat(storeInventoryItemRepository.existsByStoreIdAndNameKey(store.getId(), ItemNames.duplicateKey(" vanillasyrup "))).isTrue();
        assertThat(storeInventoryItemRepository.existsByStoreIdAndNameKey(store.getId(), ItemNames.duplicateKey("VANILLA  SYRUP"))).isTrue();
        assertThat(storeInventoryItemRepository.existsByStoreIdAndNameKey(store.getId(), ItemNames.duplicateKey("Vanilla Syrups"))).isFalse();
    }

    @Test
    void matchesALegacyRowSavedWithATabOrNonBreakingSpace() {
        Store store = store();
        item(store, "Oat\tMilk");
        item(store, "Maple Syrup");

        assertThat(storeInventoryItemRepository.existsByStoreIdAndNameKey(store.getId(), "oatmilk")).isTrue();
        assertThat(storeInventoryItemRepository.existsByStoreIdAndNameKey(store.getId(), "maplesyrup")).isTrue();
    }

    @Test
    void doesNotBlockTheSameNameInAnotherStoreOrTheItemItself() {
        Store storeA = store();
        Store storeB = store();
        StoreInventoryItem vanilla = item(storeA, "Vanilla Syrup");

        assertThat(storeInventoryItemRepository.existsByStoreIdAndNameKey(storeB.getId(), "vanillasyrup")).isFalse();
        assertThat(storeInventoryItemRepository.existsByStoreIdAndNameKeyAndIdNot(storeA.getId(), "vanillasyrup", vanilla.getId())).isFalse();

        StoreInventoryItem other = item(storeA, "VanillaSyrup");
        assertThat(storeInventoryItemRepository.existsByStoreIdAndNameKeyAndIdNot(storeA.getId(), "vanillasyrup", other.getId())).isTrue();
    }

    @Test
    void findByNameKeyReturnsEveryStoresVariantAndKeepsTheStoredNames() {
        Store storeA = store();
        Store storeB = store();
        item(storeA, "Vanilla Syrup");
        item(storeB, "vanillasyrup");
        item(storeB, "Caramel Syrup");

        assertThat(storeInventoryItemRepository.findByNameKey("vanillasyrup"))
            .extracting(StoreInventoryItem::getName)
            .containsExactlyInAnyOrder("Vanilla Syrup", "vanillasyrup");
    }
}
