package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StockCheckReceipt;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StockCheckReceiptRepository extends JpaRepository<StockCheckReceipt, Long> {

    // One item's most recent deliveries, newest first, receiver fetched -- the
    // "Stock received" entries in the Inventory Counts history.
    @Query("select r from StockCheckReceipt r "
        + "left join fetch r.receivedByUser left join fetch r.receivedBySuperAdmin "
        + "where r.storeInventoryItem.id = :itemId "
        + "order by r.receivedAt desc, r.id desc")
    List<StockCheckReceipt> findRecentForItem(@Param("itemId") Long itemId, Pageable pageable);

    // Each item's single latest delivery for a store -- shows who last touched
    // an item's stock when that was a delivery rather than a count.
    @Query("select r from StockCheckReceipt r "
        + "left join fetch r.receivedByUser left join fetch r.receivedBySuperAdmin "
        + "where r.store.id = :storeId "
        + "and r.receivedAt = (select max(r2.receivedAt) from StockCheckReceipt r2 "
        + "where r2.storeInventoryItem = r.storeInventoryItem)")
    List<StockCheckReceipt> findLatestPerItemForStore(@Param("storeId") Long storeId);

    // Deliveries that were not added to any day's row (no row existed that day).
    @Query("select r from StockCheckReceipt r where r.store.id = :storeId and r.stockCheck is null")
    List<StockCheckReceipt> findUnappliedForStore(@Param("storeId") Long storeId);

    // Same, for one item.
    @Query("select r from StockCheckReceipt r where r.storeInventoryItem.id = :itemId and r.stockCheck is null")
    List<StockCheckReceipt> findUnappliedForItem(@Param("itemId") Long itemId);
}
