package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StockCheck;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface StockCheckRepository extends JpaRepository<StockCheck, Long> {

    // The entered-by / last-updated-by users of both snapshots, fetched with
    // the check -- every response names all four. Left joins because a
    // snapshot that hasn't been taken yet has no users.
    String FETCH_SNAPSHOT_USERS = "join fetch sc.storeInventoryItem sii "
        + "left join fetch sc.startOfDayEnteredBy "
        + "left join fetch sc.startOfDayCheckedBy "
        + "left join fetch sc.endOfDayEnteredBy "
        + "left join fetch sc.endOfDayCheckedBy ";

    Optional<StockCheck> findByStoreInventoryItemIdAndCheckDate(Long storeInventoryItemId, LocalDate checkDate);

    List<StockCheck> findByStoreInventoryItemIdInAndCheckDate(List<Long> storeInventoryItemIds, LocalDate checkDate);

    // One store's records for one business day -- the employee's daily screen
    // and the EOD supplier report.
    @Query("select sc from StockCheck sc " + FETCH_SNAPSHOT_USERS
        + "where sc.store.id = :storeId and sc.checkDate = :checkDate")
    List<StockCheck> findForStoreOnDate(@Param("storeId") Long storeId, @Param("checkDate") LocalDate checkDate);

    // Owner/Admin's historical review: every record for their store within a
    // date range, most recent first, bounded by page/size. No join against
    // "active" anywhere -- a deactivated/unassigned item's past checks must
    // still show.
    @Query(
        value = "select sc from StockCheck sc " + FETCH_SNAPSHOT_USERS
            + "where sc.store.id = :storeId "
            + "and sc.checkDate between :startDate and :endDate "
            + "order by sc.checkDate desc, sii.name asc, sc.id desc",
        countQuery = "select count(sc) from StockCheck sc "
            + "where sc.store.id = :storeId "
            + "and sc.checkDate between :startDate and :endDate"
    )
    Page<StockCheck> findForStoreInRange(
        @Param("storeId") Long storeId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate,
        Pageable pageable
    );

    Optional<StockCheck> findByIdAndStoreId(Long id, Long storeId);

    // Super Admin's cross-store historical review (RTS-305): same shape as
    // findForStoreInRange, but every store -- the store itself is joined so
    // each row can carry its own store's name, ordered by store first so
    // results read as grouped by store rather than interleaved by date.
    @Query(
        value = "select sc from StockCheck sc " + FETCH_SNAPSHOT_USERS + "join fetch sc.store st "
            + "where sc.checkDate between :startDate and :endDate "
            + "order by st.name asc, sc.checkDate desc, sii.name asc, sc.id desc",
        countQuery = "select count(sc) from StockCheck sc "
            + "where sc.checkDate between :startDate and :endDate"
    )
    Page<StockCheck> findInRange(
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate,
        Pageable pageable
    );

    // Delete guard for StoreInventoryItemService: an item with any stock-check
    // history can't be hard-deleted.
    boolean existsByStoreInventoryItemId(Long storeInventoryItemId);

    // Each item's single most recent check (any date, not just today) --
    // backs the live Inventory Counts view, where an item not counted today
    // still shows its last known count flagged as stale rather than
    // disappearing. JPQL has no DISTINCT ON, so "latest per item" is a
    // correlated subquery instead.
    @Query("select sc from StockCheck sc " + FETCH_SNAPSHOT_USERS
        + "where sc.store.id = :storeId "
        + "and sc.checkDate = (select max(sc2.checkDate) from StockCheck sc2 "
        + "where sc2.storeInventoryItem = sc.storeInventoryItem)")
    List<StockCheck> findLatestPerItemForStore(@Param("storeId") Long storeId);

    // Same "latest per item" shape as findLatestPerItemForStore, but across a
    // caller-supplied set of items spanning multiple stores -- backs Super
    // Admin's cross-store stock-level comparison, which needs one store's
    // worth of items filtered to a single matching name rather than every
    // item in one store. Callers must not pass an empty list (an empty
    // "in ()" is invalid JPQL).
    @Query("select sc from StockCheck sc " + FETCH_SNAPSHOT_USERS
        + "where sc.storeInventoryItem.id in :itemIds "
        + "and sc.checkDate = (select max(sc2.checkDate) from StockCheck sc2 "
        + "where sc2.storeInventoryItem = sc.storeInventoryItem)")
    List<StockCheck> findLatestPerItemForItemIds(@Param("itemIds") List<Long> itemIds);

    // One item's most recent checks, newest first -- the count-history
    // timeline on an Inventory Counts row. Caller bounds how many via
    // Pageable (e.g. PageRequest.of(0, 15)); no total count needed so this
    // returns a plain List rather than a Page.
    @Query("select sc from StockCheck sc " + FETCH_SNAPSHOT_USERS
        + "where sc.storeInventoryItem.id = :itemId "
        + "order by sc.checkDate desc, sc.id desc")
    List<StockCheck> findRecentForItem(@Param("itemId") Long itemId, Pageable pageable);
}
