package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StockCheckSnapshot;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

// Employee saving today's Start of Day or End of Day count for one item.
// Saving the same snapshot again updates it in place.
//
// quantityReceived is only for End of Day: stock delivered today that the
// employee confirms when the closing count is higher than the opening one. It is
// added to today's received total in the same save, so usage is worked out
// against it. Null or zero means nothing was received.
public record StockCheckSubmitRequest(
    @NotNull(message = "Store is required")
    Long storeId,

    @NotNull(message = "Store item is required")
    Long storeInventoryItemId,

    @NotNull(message = "Choose Start of Day or End of Day")
    StockCheckSnapshot snapshot,

    @NotNull(message = "Available stock is required")
    @DecimalMin(value = "0", message = "Available stock cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
    BigDecimal available,

    @NotNull(message = "Dead stock is required")
    @DecimalMin(value = "0", message = "Dead stock cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
    BigDecimal deadStock,

    @DecimalMin(value = "0", message = "Received stock cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
    BigDecimal quantityReceived
) {
    public StockCheckSubmitRequest(Long storeId, Long storeInventoryItemId, StockCheckSnapshot snapshot, BigDecimal available, BigDecimal deadStock) {
        this(storeId, storeInventoryItemId, snapshot, available, deadStock, null);
    }
}
