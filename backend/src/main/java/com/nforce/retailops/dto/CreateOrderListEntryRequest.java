package com.nforce.retailops.dto;

import com.nforce.retailops.entity.InventoryItemCategory;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

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

    InventoryItemCategory category,

    @Size(max = 50, message = "Unit must be at most 50 characters")
    String unitOfMeasurement,

    boolean saveToInventory,

    @Min(value = 0, message = "Weekday min cannot be negative")
    Integer minWeekday,

    @Min(value = 0, message = "Weekend min cannot be negative")
    Integer minWeekend,

    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    Integer quantityNeeded,

    Long supplierId,

    @Size(max = 500, message = "Note must be 500 characters or fewer")
    String note
) {
}
