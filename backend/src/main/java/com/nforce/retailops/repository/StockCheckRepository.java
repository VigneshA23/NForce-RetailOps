package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StockCheck;
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
    // date range, most recent first.
    @Query("select sc from StockCheck sc "
        + "where sc.storeInventoryItem.store.id = :storeId "
        + "and sc.checkDate between :startDate and :endDate "
        + "order by sc.checkDate desc, sc.id desc")
    List<StockCheck> findForStoreInRange(
        @Param("storeId") Long storeId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    Optional<StockCheck> findByIdAndStoreInventoryItemStoreId(Long id, Long storeId);
}
