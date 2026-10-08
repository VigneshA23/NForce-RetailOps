package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StockCheckSnapshot;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

// Owner/Admin correcting one snapshot of a past (or today's) stock check.
public record StockCheckCorrectionRequest(
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

    // Optional -- no current UI sets this (no correction screen exists yet),
    // but the audit trail (StockCheckCorrection) can carry it when one does.
    @Size(max = 200, message = "Reason cannot exceed 200 characters")
    String reason
) {
}
