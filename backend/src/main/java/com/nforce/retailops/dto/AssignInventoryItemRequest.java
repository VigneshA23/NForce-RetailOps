package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotNull;

public record AssignInventoryItemRequest(
    @NotNull(message = "Store is required")
    Long storeId,

    @NotNull(message = "Inventory item is required")
    Long inventoryItemId
) {
}
