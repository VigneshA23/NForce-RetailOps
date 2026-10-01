package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StockCheckSnapshot;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// Owner/Admin correcting one snapshot of a past (or today's) stock check.
public record StockCheckCorrectionRequest(
    @NotNull(message = "Choose Start of Day or End of Day")
    StockCheckSnapshot snapshot,

    @NotNull(message = "Available stock is required")
    @Min(value = 0, message = "Available stock cannot be negative")
    Integer available,

    @NotNull(message = "Dead stock is required")
    @Min(value = 0, message = "Dead stock cannot be negative")
    Integer deadStock,

    // Optional -- no current UI sets this (no correction screen exists yet),
    // but the audit trail (StockCheckCorrection) can carry it when one does.
    @Size(max = 200, message = "Reason cannot exceed 200 characters")
    String reason
) {
}
