package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

// Super Admin's correction to an existing cash entry: every field is
// required even if unchanged, so the server sees exactly what the Super
// Admin confirmed. The reason is free text, >= 5 non-blank chars; the five
// amounts default-check non-negativeness in the service except
// otherAdjustments which is signed.
public record SuperAdminCashCorrectionRequest(
    @NotNull BigDecimal openingDrawerCash,
    @NotNull BigDecimal cashExpenses,
    @NotNull BigDecimal cashRemoved,
    @NotNull BigDecimal cashRemaining,
    @NotNull BigDecimal otherAdjustments,
    @NotNull @Size(min = 5, max = 2000, message = "Reason is required")
    String reason
) {
}
