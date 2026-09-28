package com.nforce.retailops.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

// Owner/Admin correcting a past employee stock check.
public record StockCheckCorrectionRequest(
    @NotNull(message = "Current count is required")
    @Min(value = 0, message = "Current count cannot be negative")
    Integer currentCount,

    // Optional -- no current UI sets this (no correction screen exists yet),
    // but the audit trail (StockCheckCorrection) can carry it when one does.
    @Size(max = 200, message = "Reason cannot exceed 200 characters")
    String reason
) {
}
