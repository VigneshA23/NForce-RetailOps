package com.nforce.retailops.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CreateStoreRequest(
    @NotBlank(message = "Store name is required")
    @Size(max = 150, message = "Store name must be 150 characters or fewer")
    String name,

    @NotBlank(message = "Store location is required")
    String location,

    // The store's cash-drawer target, saved in the same transaction as the
    // store itself (StoreCashTargetService), so either both save or neither.
    @NotNull(message = "Cash target is required")
    @DecimalMin(value = "0", message = "Cash target cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Cash target: use at most 2 decimal places")
    BigDecimal cashTarget
) {
}
