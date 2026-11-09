package com.nforce.retailops.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record StoreCashTargetRequest(
    @NotNull(message = "Target amount is required")
    @DecimalMin(value = "0", message = "Target amount cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Target amount: use at most 2 decimal places")
    BigDecimal targetAmount
) {
}
