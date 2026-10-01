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

    // Delete guard for StoreInventoryItemService: an item with any stock-check
    // history can't be hard-deleted.
    boolean existsByStoreInventoryItemId(Long storeInventoryItemId);
}
