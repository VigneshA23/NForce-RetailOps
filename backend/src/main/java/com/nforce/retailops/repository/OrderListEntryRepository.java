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

    // Entries marked Ordered within [from, to), whatever status they've reached since.
    List<OrderListEntry> findByStoreIdAndOrderedAtGreaterThanEqualAndOrderedAtLessThan(Long storeId, OffsetDateTime from, OffsetDateTime to);

    List<OrderListEntry> findByStoreIdAndStatusNotOrderByCreatedAtDesc(Long storeId, OrderStatus status);

    Optional<OrderListEntry> findByIdAndStoreId(Long id, Long storeId);

    // Every requirement is its own row, so an item can have several active
    // entries. The system-raised Needs Ordering row (ad_hoc = false) is the only
    // one a stock count may touch; the partial unique index in V94 allows one.
    List<OrderListEntry> findByStoreIdAndStoreInventoryItemIdAndStatusAndAdHocFalse(Long storeId, Long storeInventoryItemId, OrderStatus status);

    // Any Needs Ordering row for the item, system-raised or manual, oldest
    // first -- where a manual add tops up (Manual column) instead of stacking.
    List<OrderListEntry> findByStoreIdAndStoreInventoryItemIdAndStatusOrderByCreatedAtAsc(Long storeId, Long storeInventoryItemId, OrderStatus status);

    boolean existsByStoreIdAndStoreInventoryItemIdAndStatusNot(Long storeId, Long storeInventoryItemId, OrderStatus status);

    // Delete guard for StoreInventoryItemService: an item with outstanding or
    // historical order-list entries can't be hard-deleted.
    boolean existsByStoreInventoryItemId(Long storeInventoryItemId);

    boolean existsBySupplierId(Long supplierId);

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
    //        [2] order entry count, [3] total quantity, [4] received count.
    // receivedCount uses count(case when ... then e.id end) rather than a
    // FILTER clause: plain CASE/COUNT is standard JPQL that both PostgreSQL
    // and H2 (the test profile) execute identically, where FILTER support
    // varies. The THEN branch must be basic-valued (e.id, not e itself) --
    // Hibernate 6's CaseSearchedExpression cannot resolve an entity there.
    @Query("select sup.id, sup.name, count(e), sum(e.quantityNeeded), "
        + "count(case when e.status = :receivedStatus then e.id end) "
        + "from OrderListEntry e left join e.supplier sup "
        + "where e.store.id = :storeId and e.status in :statuses "
        + "and e.createdAt >= :from and e.createdAt < :to "
        + "group by sup.id, sup.name")
    List<Object[]> findSupplierMetricsForStore(
        @Param("storeId") Long storeId,
        @Param("statuses") List<OrderStatus> statuses,
        @Param("receivedStatus") OrderStatus receivedStatus,
        @Param("from") OffsetDateTime from,
        @Param("to") OffsetDateTime to
    );

    // Order History (Owner/Admin and Super Admin): every entry whose status is
    // in `statuses` (ORDERED/RECEIVED -- see OrderStatus.PURCHASED_STATUSES, so
    // NEEDS_ORDERING never appears in this per-line report) and whose
    // createdAt falls in [from, to), for one store. Entities rather than a
    // tuple projection -- the per-line report needs the item's category/unit/
    // image too, which live on StoreInventoryItem, not on this row. The date
    // range is capped at 92 days (OrderListService.MAX_DATE_RANGE_DAYS), the
    // same bound the Purchasing Summary already enforces, so filtering and
    // paging in the service (StockCheckService.listInventoryCounts' own
    // convention) stays cheap -- no Pageable/COUNT query needed here.
    List<OrderListEntry> findByStoreIdAndStatusInAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
        Long storeId, List<OrderStatus> statuses, OffsetDateTime from, OffsetDateTime to);

    // Same as above but platform-wide and additionally grouped by store --
    // Super Admin's cross-store Supplier Purchasing Summary. `join e.store s`
    // is safe as an inner join (store_id is NOT NULL on every entry).
    //
    // Tuple: [0] storeId, [1] storeName, [2] supplierId (nullable),
    //        [3] supplierName (nullable), [4] order entry count, [5] total
    //        quantity, [6] received count.
    @Query("select s.id, s.name, sup.id, sup.name, count(e), sum(e.quantityNeeded), "
        + "count(case when e.status = :receivedStatus then e.id end) "
        + "from OrderListEntry e join e.store s left join e.supplier sup "
        + "where e.status in :statuses "
        + "and e.createdAt >= :from and e.createdAt < :to "
        + "group by s.id, s.name, sup.id, sup.name")
    List<Object[]> findSupplierMetricsGroupedByStore(
        @Param("statuses") List<OrderStatus> statuses,
        @Param("receivedStatus") OrderStatus receivedStatus,
        @Param("from") OffsetDateTime from,
        @Param("to") OffsetDateTime to
    );
}
