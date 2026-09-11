package com.nforce.retailops.dto;

import com.nforce.retailops.entity.OrderStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateOrderListEntryRequest(
    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    Integer quantityNeeded,

    Long supplierId,

    @Size(max = 500, message = "Note must be 500 characters or fewer")
    String note,

    @NotNull(message = "Status is required")
    OrderStatus status
) {
}
