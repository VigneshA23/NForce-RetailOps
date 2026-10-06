package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreInventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StoreInventoryItemRepository extends JpaRepository<StoreInventoryItem, Long> {

    List<StoreInventoryItem> findByStoreIdOrderById(Long storeId);

    List<StoreInventoryItem> findByStoreIdAndActiveTrueOrderById(Long storeId);

    Optional<StoreInventoryItem> findByIdAndStoreId(Long id, Long storeId);

    // Every store's item with this exact name, case-insensitive -- there is
    // no shared item catalog, so "the same item across stores" can only be
    // matched by name. Includes inactive items; callers filter those out
    // when "assigned" should mean "currently tracked".
    List<StoreInventoryItem> findByNameIgnoreCase(String name);

    // Duplicate-name guard for a single store (RTS-301): deliberately not
    // scoped to active=true, mirroring CategoryService.namesOverlapInStores,
    // which also blocks on a deactivated row's name rather than freeing it up.
    boolean existsByStoreIdAndNameIgnoreCase(Long storeId, String name);

    boolean existsByStoreIdAndNameIgnoreCaseAndIdNot(Long storeId, String name, Long id);
}
