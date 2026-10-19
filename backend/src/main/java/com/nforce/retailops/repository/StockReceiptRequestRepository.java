package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StockReceiptRequest;
import com.nforce.retailops.entity.StockReceiptRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface StockReceiptRequestRepository extends JpaRepository<StockReceiptRequest, Long> {

    Optional<StockReceiptRequest> findByIdAndStoreId(Long id, Long storeId);

    // Pending reports for one store's day, so the employee screen and the
    // End of Day usage check can count what is already waiting on approval.
    List<StockReceiptRequest> findByStoreIdAndCheckDateAndStatus(Long storeId, LocalDate checkDate, StockReceiptRequestStatus status);

    // Restock reported with End of Day and still pending. Start of Day restocks
    // are separate: they sit inside the Start of Day count itself.
    @Query("select coalesce(sum(r.quantity), 0) from StockReceiptRequest r "
        + "where r.storeInventoryItem.id = :itemId and r.checkDate = :date and r.status = 'PENDING' "
        + "and r.type = 'RESTOCK' and r.snapshot = 'END_OF_DAY'")
    java.math.BigDecimal pendingQuantityFor(@Param("itemId") Long itemId, @Param("date") LocalDate date);

    // Restock reported with Start of Day that is pending or already approved,
    // i.e. what explains a Start of Day above yesterday's End of Day.
    @Query("select coalesce(sum(r.quantity), 0) from StockReceiptRequest r "
        + "where r.storeInventoryItem.id = :itemId and r.checkDate = :date "
        + "and r.status in ('PENDING', 'APPROVED') and r.type = 'RESTOCK' and r.snapshot = 'START_OF_DAY'")
    java.math.BigDecimal startRestockCoveredFor(@Param("itemId") Long itemId, @Param("date") LocalDate date);

    // The latest Start of Day lower-count request for the item that day.
    Optional<StockReceiptRequest> findFirstByStoreInventoryItemIdAndCheckDateAndTypeAndStatusInOrderByIdDesc(
        Long itemId, LocalDate checkDate, com.nforce.retailops.entity.StockReceiptRequestType type,
        java.util.Collection<StockReceiptRequestStatus> statuses);

    // Every Start of Day request for a store's day, so the employee screen can
    // show which items are waiting on, or were turned down by, the admin.
    List<StockReceiptRequest> findByStoreIdAndCheckDateAndSnapshotOrderByIdAsc(
        Long storeId, LocalDate checkDate, com.nforce.retailops.entity.StockCheckSnapshot snapshot);

    boolean existsByOrderListEntryIdAndStatus(Long orderListEntryId, StockReceiptRequestStatus status);

    // Every request for one item/day/snapshot with the given status -- used to
    // block resubmission while one is PENDING, and to find the sibling rows of
    // a multi-delivery submission so an owner can approve/reject any one of
    // them and have the held-back count (if any) go with it.
    List<StockReceiptRequest> findByStoreInventoryItemIdAndCheckDateAndSnapshotAndStatus(
        Long storeInventoryItemId, LocalDate checkDate,
        com.nforce.retailops.entity.StockCheckSnapshot snapshot, StockReceiptRequestStatus status);
}
