package com.nforce.retailops.dto;

import com.nforce.retailops.entity.OrderStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record UpdateOrderListEntryRequest(
    @NotNull(message = "Quantity is required")
    @DecimalMin(value = "0.01", message = "Quantity must be greater than 0")
    @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
    BigDecimal quantityNeeded,

    Long supplierId,

    @Size(max = 500, message = "Note must be 500 characters or fewer")
    String note,

    @NotNull(message = "Status is required")
    OrderStatus status,

    // The status the caller was looking at when they made this edit. If the
    // entry has since moved on (e.g. Super Admin already marked it Ordered),
    // the update is rejected with a conflict instead of overwriting. Optional
    // so older clients keep working unchecked.
    OrderStatus expectedStatus,

    // Only read when moving Ordered -> Received: what actually arrived.
    // Omitted means "everything that was ordered".
    @DecimalMin(value = "0.01", message = "Quantity received must be greater than 0")
    @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
    BigDecimal quantityReceived
) {
    public UpdateOrderListEntryRequest(BigDecimal quantityNeeded, Long supplierId, String note, OrderStatus status, OrderStatus expectedStatus) {
        this(quantityNeeded, supplierId, note, status, expectedStatus, null);
    }

    public UpdateOrderListEntryRequest(BigDecimal quantityNeeded, Long supplierId, String note, OrderStatus status) {
        this(quantityNeeded, supplierId, note, status, null, null);
    }
}
