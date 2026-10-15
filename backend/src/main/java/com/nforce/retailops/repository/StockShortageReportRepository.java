package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StockShortageReport;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StockShortageReportRepository extends JpaRepository<StockShortageReport, Long> {

    // One item's most recent reports, newest first -- the "Shortage reported"
    // entries in the Inventory Counts history.
    @Query("select r from StockShortageReport r join fetch r.reportedBy "
        + "where r.storeInventoryItem.id = :itemId order by r.reportedAt desc, r.id desc")
    List<StockShortageReport> findRecentForItem(@Param("itemId") Long itemId, Pageable pageable);

    // Each item's single latest report for a store.
    @Query("select r from StockShortageReport r join fetch r.reportedBy "
        + "where r.store.id = :storeId "
        + "and r.reportedAt = (select max(r2.reportedAt) from StockShortageReport r2 "
        + "where r2.storeInventoryItem = r.storeInventoryItem)")
    List<StockShortageReport> findLatestPerItemForStore(@Param("storeId") Long storeId);
}
