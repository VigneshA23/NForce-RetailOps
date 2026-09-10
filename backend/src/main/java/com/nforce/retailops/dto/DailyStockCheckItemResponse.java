package com.nforce.retailops.dto;

// One row of the employee's Daily Stock Check screen: an active store item,
// today's resolved minimum target (weekday/weekend already picked server-side),
// and today's check if one has already been submitted.
public record DailyStockCheckItemResponse(
    Long storeInventoryItemId,
    String itemName,
    String categoryName,
    String unitOfMeasurement,
    Integer minTarget,
    Integer currentCount,
    Integer quantityNeeded,
    boolean checkedToday
) {
}
