package com.nforce.retailops.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

// Owner/Admin manually adding to the order list ("Add to order"), outside
// the automatic shortage detection in StockCheckService. Exactly one of two
// shapes, validated in OrderListService:
//  - storeInventoryItemId set: an existing catalog item.
//  - storeInventoryItemId null: a one-off item, described by itemName/
//    category/unitOfMeasurement. saveToInventory decides whether it's also
//    kept as a real (active) catalog item afterward, or created inactive
//    purely to satisfy order_list_entries' required item reference.
//    minWeekday/minWeekend only matter when saveToInventory is true --
//    minWeekday defaults to 0 when omitted, minWeekend stays null (falls
//    back to minWeekday, same as the main catalog form).
public record CreateOrderListEntryRequest(
    Long storeInventoryItemId,

    @Size(max = 200, message = "Name must be at most 200 characters")
    String itemName,

    String category,

    @Size(max = 50, message = "Unit must be at most 50 characters")
    String unitOfMeasurement,

    boolean saveToInventory,

    @DecimalMin(value = "0", message = "Weekday min cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
    BigDecimal minWeekday,

    @DecimalMin(value = "0", message = "Weekend min cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
    BigDecimal minWeekend,

    @NotNull(message = "Quantity is required")
    @DecimalMin(value = "0.01", message = "Quantity must be greater than 0")
    @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
    BigDecimal quantityNeeded,

    Long supplierId,

    @Size(max = 500, message = "Note must be 500 characters or fewer")
    String note
) {
}
