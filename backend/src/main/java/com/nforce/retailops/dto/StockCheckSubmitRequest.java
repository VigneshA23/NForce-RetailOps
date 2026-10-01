package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StockCheckSnapshot;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

// Employee saving today's Start of Day or End of Day count for one item.
// Saving the same snapshot again updates it in place.
public record StockCheckSubmitRequest(
    @NotNull(message = "Store is required")
    Long storeId,

    @NotNull(message = "Store item is required")
    Long storeInventoryItemId,

    @NotNull(message = "Choose Start of Day or End of Day")
    StockCheckSnapshot snapshot,

    @NotNull(message = "Available stock is required")
    @Min(value = 0, message = "Available stock cannot be negative")
    Integer available,

    @NotNull(message = "Dead stock is required")
    @Min(value = 0, message = "Dead stock cannot be negative")
    Integer deadStock
) {
}
