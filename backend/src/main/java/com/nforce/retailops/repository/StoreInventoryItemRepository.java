package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreInventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
    // Distinct (store, category) pairs for the given stores, backing the
    // "categories common to the selected stores" lookup on the Super Admin form.
    @Query("select distinct i.store.id, i.category from StoreInventoryItem i "
        + "where i.store.id in :storeIds and i.category is not null")
    List<Object[]> findStoreCategories(@Param("storeIds") java.util.Collection<Long> storeIds);

    // Detaches a removed/deactivated supplier from every item that preferred it.
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update StoreInventoryItem i set i.preferredSupplier = null where i.preferredSupplier.id = :supplierId")
    int clearPreferredSupplier(@Param("supplierId") Long supplierId);
}
