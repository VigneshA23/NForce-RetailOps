package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

// One item on the employee's daily Stock Check screen: today's resolved
// minimum (weekday/weekend already picked server-side), tomorrow's, and
// today's Start of Day / End of Day snapshots (each null until taken).
// stockUsed needs both snapshots; quantityToOrder needs End of Day.
public record DailyStockCheckItemResponse(
    Long storeInventoryItemId,
    String itemName,
    String unitOfMeasurement,
    BigDecimal minTarget,
    BigDecimal requiredTomorrow,
    StockSnapshotResponse startOfDay,
    StockSnapshotResponse endOfDay,
    BigDecimal quantityReceived,
    // Usable stock now: the latest count (End of Day, else the last mid-day
    // report, else Start of Day) plus deliveries since; null before Start of Day.
    BigDecimal currentStock,
    BigDecimal stockUsed,
    BigDecimal quantityToOrder,
    Long imageId,
    // Received stock already reported today and still waiting on the admin.
    BigDecimal pendingReceivedQuantity,
    // Ordered orders for the item that the employee can confirm as received
    // (those with a request already pending are left out).
    List<OpenOrder> openOrders,
    // Yesterday's (or the last counted day's) End of Day, which Start of Day is
    // reconciled against; null when there is none.
    PreviousEndOfDay previousEndOfDay,
    // The Start of Day request still open or turned down for today, if any.
    StartOfDayReview startOfDayReview,
    // True once the order raised from today's Start of Day is marked Ordered:
    // Start of Day can no longer be edited today.
    boolean startOfDayLocked,
    // Set while yesterday's Start of Day for this item still has no End of Day
    // (counted or explained): today's Start of Day is refused until it is
    // answered from the Notifications page.
    MissedEndOfDay missedEndOfDay
) {
    public record MissedEndOfDay(java.time.LocalDate date) {
    }

    // expectedStart is that End of Day plus deliveries received since, i.e. the
    // usable stock Start of Day should come to. restockCovered / lowerCovered are
    // what today's pending or approved Start of Day requests already explain
    // (a restock above it, a lower count below it).
    public record PreviousEndOfDay(
        java.time.LocalDate date, BigDecimal usable, BigDecimal expectedStart,
        Long submittedById, String submittedByName, OffsetDateTime submittedAt,
        BigDecimal restockCovered, BigDecimal lowerCovered
    ) {
    }

    // type is RESTOCK or LOWER_COUNT, status PENDING or REJECTED.
    public record StartOfDayReview(String type, String status, BigDecimal quantity, String reason) {
    }

    public record OpenOrder(Long id, BigDecimal quantity, String supplierName, OffsetDateTime orderedAt) {
    }
}
