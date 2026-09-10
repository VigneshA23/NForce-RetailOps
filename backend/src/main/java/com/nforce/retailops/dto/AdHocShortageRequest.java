package com.nforce.retailops.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// storeInventoryItemId (not inventoryItemId) -- the employee picks from the
// same store-scoped list already shown on their Daily Stock Check screen.
public record AdHocShortageRequest(
    @NotNull(message = "Item is required")
    Long storeInventoryItemId,

    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    Integer quantity,

    @Size(max = 500, message = "Note must be 500 characters or fewer")
    String note
) {
}
