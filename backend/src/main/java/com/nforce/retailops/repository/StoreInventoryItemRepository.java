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

    // Reverse lookup from an image row to the one item that owns it (every
    // item has its own image row), so the image endpoint can tell which
    // store an uploaded picture belongs to.
    @Query("select i from StoreInventoryItem i where i.image.id = :imageId")
    Optional<StoreInventoryItem> findByImageId(@Param("imageId") Long imageId);

    // Every store's item with this exact name, case-insensitive -- there is
    // no shared item catalog, so "the same item across stores" can only be
    // matched by name. Includes inactive items; callers filter those out
    // when "assigned" should mean "currently tracked".
    // Compared on the trimmed, lower-cased stored name so a row saved before
    // names were tidied (e.g. "Vanilla ") still matches. Pass a name already
    // tidied by ItemNames.normalize.
    @Query("select i from StoreInventoryItem i where lower(trim(i.name)) = lower(:name)")
    List<StoreInventoryItem> findByNameIgnoreCase(@Param("name") String name);

    // The stored name as a duplicate key (RTS-583): lower-cased with spaces,
    // tabs and non-breaking spaces removed, so "Vanilla Syrup" and
    // "VanillaSyrup" collide. Must stay in step with ItemNames.duplicateKey;
    // pass that as :nameKey. Names saved through ItemNames.normalize only ever
    // hold plain spaces -- tab and non-breaking space cover older rows.
    String NAME_KEY = "lower(replace(replace(replace(i.name, ' ', ''), '\t', ''), ' ', ''))";

    // Every store's item whose name is a duplicate of :nameKey (see NAME_KEY),
    // backing the Super Admin multi-store create's duplicate check. Includes
    // inactive items.
    @Query("select i from StoreInventoryItem i where " + NAME_KEY + " = :nameKey")
    List<StoreInventoryItem> findByNameKey(@Param("nameKey") String nameKey);

    // Duplicate-name guard for a single store (RTS-301, widened by RTS-583 to
    // ignore spaces inside the name): deliberately not scoped to active=true,
    // mirroring CategoryService.namesOverlapInStores, which also blocks on a
    // deactivated row's name rather than freeing it up.
    @Query("select case when count(i) > 0 then true else false end from StoreInventoryItem i "
        + "where i.store.id = :storeId and " + NAME_KEY + " = :nameKey")
    boolean existsByStoreIdAndNameKey(@Param("storeId") Long storeId, @Param("nameKey") String nameKey);

    @Query("select case when count(i) > 0 then true else false end from StoreInventoryItem i "
        + "where i.store.id = :storeId and " + NAME_KEY + " = :nameKey and i.id <> :id")
    boolean existsByStoreIdAndNameKeyAndIdNot(
        @Param("storeId") Long storeId, @Param("nameKey") String nameKey, @Param("id") Long id);
    // Distinct (store, category) pairs for the given stores, backing the
    // "categories common to the selected stores" lookup on the Super Admin form.
    @Query("select distinct i.store.id, i.category from StoreInventoryItem i "
        + "where i.store.id in :storeIds and i.category is not null")
    List<Object[]> findStoreCategories(@Param("storeIds") java.util.Collection<Long> storeIds);

    // Whether any item (any store) still uses this category name -- backs the
    // Super Admin "deactivate instead of delete a category in use" guard,
    // same precedent as Supplier's order-history check.
    boolean existsByCategoryIgnoreCase(String category);

    // Detaches a removed/deactivated supplier from every item that preferred it.
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update StoreInventoryItem i set i.preferredSupplier = null where i.preferredSupplier.id = :supplierId")
    int clearPreferredSupplier(@Param("supplierId") Long supplierId);
}
