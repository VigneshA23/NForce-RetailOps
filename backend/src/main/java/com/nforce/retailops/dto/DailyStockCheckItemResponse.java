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
    List<OpenOrder> openOrders
) {
    public record OpenOrder(Long id, BigDecimal quantity, String supplierName, OffsetDateTime orderedAt) {
    }
}
