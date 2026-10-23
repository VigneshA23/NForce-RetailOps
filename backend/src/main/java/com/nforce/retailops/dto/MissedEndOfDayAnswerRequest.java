package com.nforce.retailops.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

// The answer to one item's missing End of Day from yesterday: either the count
// (available and deadStock) or couldNotCount with a reason of at least 5
// words. storeId is only read for employees; an Owner/Admin answers for their
// own store.
public record MissedEndOfDayAnswerRequest(
    Long storeId,

    @NotNull(message = "Store item is required")
    Long storeInventoryItemId,

    @DecimalMin(value = "0", message = "Available stock cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
    BigDecimal available,

    @DecimalMin(value = "0", message = "Dead stock cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
    BigDecimal deadStock,

    boolean couldNotCount,

    @Size(max = 1000, message = "Reason can be at most 1000 characters")
    String reason
) {
}
