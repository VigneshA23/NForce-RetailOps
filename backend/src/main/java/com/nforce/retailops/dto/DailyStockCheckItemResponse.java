package com.nforce.retailops.dto;

import java.math.BigDecimal;

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
    BigDecimal stockUsed,
    BigDecimal quantityToOrder,
    Long imageId
) {
}
