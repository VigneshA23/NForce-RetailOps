package com.nforce.retailops.repository;

import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface OrderListEntryRepository extends JpaRepository<OrderListEntry, Long> {

    List<OrderListEntry> findByStoreIdOrderByCreatedAtDesc(Long storeId);

    List<OrderListEntry> findByStoreIdAndStatusNotOrderByCreatedAtDesc(Long storeId, OrderStatus status);

    Optional<OrderListEntry> findByIdAndStoreId(Long id, Long storeId);

    // The "find" half of the find-or-create upsert for the active-entry-per-
    // item rule enforced at the DB level by the V49/V70 partial unique index.
    Optional<OrderListEntry> findByStoreIdAndStoreInventoryItemIdAndStatusNot(Long storeId, Long storeInventoryItemId, OrderStatus status);

    // Delete guard for StoreInventoryItemService: an item with outstanding or
    // historical order-list entries can't be hard-deleted.
    boolean existsByStoreInventoryItemId(Long storeInventoryItemId);

    // Scalar badge count for the Owner/Admin Home tile -- only entries still
    // awaiting an order, so an entry stops contributing the moment the owner
    // advances it to ORDERED.
    long countByStoreIdAndStatus(Long storeId, OrderStatus status);

    // Super Admin's platform-wide outstanding-orders table, in one grouped pass
    // rather than a per-store loop. Notes on the join shape, which is the whole
    // substance of this query:
    //
    //  - `join e.store s`: store_id is NOT NULL, so this inner join drops nothing
    //    and every matching entry lands in exactly one group. That is what makes
    //    summing the group counts in the service an exact platform total.
    //  - `left join StoreOwner so on ... and so.active = true`: a store with no
    //    StoreOwner row, or one whose owner access was revoked, must still appear
    //    -- an ownerless store with a growing shortage list is precisely what this
    //    report exists to surface. An inner join, or moving so.active into the
    //    where clause, would silently drop exactly those stores. Keeping the
    //    active check in the ON clause also stops a revoked link (which retains
    //    its owner reference -- see StoreOwner.resolveTaskOwnerId) rendering a
    //    stale owner name.
    //  - `left join so.owner o`: StoreOwner.owner is itself nullable, so
    //    navigating so.owner.fullName inline would be an implicit INNER join and
    //    drop the row.
    //  - No fan-out risk: store_owners.store_id is UNIQUE, so at most one link
    //    joins per store. count(distinct e) is a second line of defence.
    //  - Stores with nothing outstanding are absent by construction (the where
    //    clause), not post-filtered.
    //  - Every non-aggregated select item is repeated in GROUP BY, as PostgreSQL
    //    requires and as H2 in PostgreSQL mode (the test profile) also enforces.
    //  - The s.id tiebreak makes the service's row cap a deterministic cut rather
    //    than an arbitrary one.
    //
    // Tuple: [0] storeId, [1] storeCode, [2] storeName, [3] ownerName (nullable),
    //        [4] count, [5] oldest createdAt.
    @Query("select s.id, s.storeCode, s.name, o.fullName, count(distinct e), min(e.createdAt) "
        + "from OrderListEntry e "
        + "join e.store s "
        + "left join StoreOwner so on so.store = s and so.active = true "
        + "left join so.owner o "
        + "where e.status = :status "
        + "group by s.id, s.storeCode, s.name, o.fullName "
        + "order by count(distinct e) desc, s.id asc")
    List<Object[]> findOutstandingRowsGroupedByStore(@Param("status") OrderStatus status);

    // Supplier Purchasing Summary (Owner/Admin): one store's entries whose
    // status is in `statuses` (ORDERED/RECEIVED -- see OrderStatus.PURCHASED_STATUSES)
    // and whose createdAt falls in [from, to), grouped by supplier. A `left join`
    // because supplier is nullable on OrderListEntry -- an inner join would
    // silently drop entries with no assigned supplier instead of grouping them
    // under their own null-supplier row. COUNT/SUM happen here, in the
    // database, not in Java.
    //
    // Tuple: [0] supplierId (nullable), [1] supplierName (nullable),
    //        [2] order entry count, [3] total quantity.
    @Query("select sup.id, sup.name, count(e), sum(e.quantityNeeded) "
        + "from OrderListEntry e left join e.supplier sup "
        + "where e.store.id = :storeId and e.status in :statuses "
        + "and e.createdAt >= :from and e.createdAt < :to "
        + "group by sup.id, sup.name")
    List<Object[]> findSupplierMetricsForStore(
        @Param("storeId") Long storeId,
        @Param("statuses") List<OrderStatus> statuses,
        @Param("from") OffsetDateTime from,
        @Param("to") OffsetDateTime to
    );

    // Same as above but platform-wide and additionally grouped by store --
    // Super Admin's cross-store Supplier Purchasing Summary. `join e.store s`
    // is safe as an inner join (store_id is NOT NULL on every entry).
    //
    // Tuple: [0] storeId, [1] storeName, [2] supplierId (nullable),
    //        [3] supplierName (nullable), [4] order entry count, [5] total quantity.
    @Query("select s.id, s.name, sup.id, sup.name, count(e), sum(e.quantityNeeded) "
        + "from OrderListEntry e join e.store s left join e.supplier sup "
        + "where e.status in :statuses "
        + "and e.createdAt >= :from and e.createdAt < :to "
        + "group by s.id, s.name, sup.id, sup.name")
    List<Object[]> findSupplierMetricsGroupedByStore(
        @Param("statuses") List<OrderStatus> statuses,
        @Param("from") OffsetDateTime from,
        @Param("to") OffsetDateTime to
    );
}
