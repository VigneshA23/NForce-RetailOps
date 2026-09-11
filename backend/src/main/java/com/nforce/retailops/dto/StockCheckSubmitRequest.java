package com.nforce.retailops.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record StockCheckSubmitRequest(
    @NotNull(message = "Store is required")
    Long storeId,

    @NotNull(message = "Store item is required")
    Long storeInventoryItemId,

    @NotNull(message = "Current count is required")
    @Min(value = 0, message = "Current count cannot be negative")
    Integer currentCount
) {
}
