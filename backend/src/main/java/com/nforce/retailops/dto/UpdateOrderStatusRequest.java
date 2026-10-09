package com.nforce.retailops.dto;

import com.nforce.retailops.entity.OrderStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record UpdateOrderStatusRequest(
    @NotNull(message = "Status is required")
    OrderStatus status,

    // See UpdateOrderListEntryRequest.expectedStatus.
    OrderStatus expectedStatus,

    // See UpdateOrderListEntryRequest.quantityReceived.
    @DecimalMin(value = "0.01", message = "Quantity received must be greater than 0")
    @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
    BigDecimal quantityReceived
) {
    public UpdateOrderStatusRequest(OrderStatus status, OrderStatus expectedStatus) {
        this(status, expectedStatus, null);
    }

    public UpdateOrderStatusRequest(OrderStatus status) {
        this(status, null, null);
    }
}
