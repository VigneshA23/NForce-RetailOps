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

    Optional<StockCheck> findByStoreInventoryItemIdAndCheckDate(Long storeInventoryItemId, LocalDate checkDate);

    List<StockCheck> findByStoreInventoryItemIdInAndCheckDate(List<Long> storeInventoryItemIds, LocalDate checkDate);

    // Owner/Admin's historical review: every check for their store within a
    // date range, most recent first, bounded by page/size. join fetch avoids
    // the per-row N+1 the unpaged version used to incur (storeInventoryItem,
    // which now carries the item name itself, and checkedBy are both read for
    // every row). No inner
    // join against "active" anywhere -- a deactivated/unassigned item's past
    // checks must still show.
    @Query(
        value = "select sc from StockCheck sc "
            + "join fetch sc.storeInventoryItem sii "
            + "join fetch sc.checkedBy "
            + "where sii.store.id = :storeId "
            + "and sc.checkDate between :startDate and :endDate "
            + "order by sc.checkDate desc, sc.id desc",
        countQuery = "select count(sc) from StockCheck sc "
            + "where sc.storeInventoryItem.store.id = :storeId "
            + "and sc.checkDate between :startDate and :endDate"
    )
    Page<StockCheck> findForStoreInRange(
        @Param("storeId") Long storeId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate,
        Pageable pageable
    );

    Optional<StockCheck> findByIdAndStoreInventoryItemStoreId(Long id, Long storeId);

    // Delete guard for StoreInventoryItemService: an item with any stock-check
    // history can't be hard-deleted.
    boolean existsByStoreInventoryItemId(Long storeInventoryItemId);
}
