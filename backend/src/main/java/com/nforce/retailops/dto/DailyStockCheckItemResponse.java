package com.nforce.retailops.dto;

// One item on the employee's daily Stock Check screen: today's resolved
// minimum (weekday/weekend already picked server-side), tomorrow's, and
// today's Start of Day / End of Day snapshots (each null until taken).
// stockUsed needs both snapshots; quantityToOrder needs End of Day.
public record DailyStockCheckItemResponse(
    Long storeInventoryItemId,
    String itemName,
    String unitOfMeasurement,
    Integer minTarget,
    Integer requiredTomorrow,
    StockSnapshotResponse startOfDay,
    StockSnapshotResponse endOfDay,
    Integer stockUsed,
    Integer quantityToOrder
) {
}
