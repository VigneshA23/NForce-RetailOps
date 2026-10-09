package com.nforce.retailops.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

// storeInventoryItemId (not inventoryItemId) -- the employee picks from the
// same store-scoped list already shown on their Daily Stock Check screen.
public record AdHocShortageRequest(
    @NotNull(message = "Item is required")
    Long storeInventoryItemId,

    // Usable stock on hand right now; the usage since Start of Day (or the
    // previous report) is banked from it.
    @NotNull(message = "Current stock is required")
    @DecimalMin(value = "0", message = "Current stock cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
    BigDecimal currentStock,

    @NotNull(message = "Quantity is required")
    @DecimalMin(value = "0.01", message = "Quantity must be greater than 0")
    @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
    BigDecimal quantity,

    @Size(max = 500, message = "Note must be 500 characters or fewer")
    String note
) {
}
