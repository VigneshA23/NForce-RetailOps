package com.nforce.retailops.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

// Owner/Admin correcting a past employee stock check.
public record StockCheckCorrectionRequest(
    @NotNull(message = "Current count is required")
    @Min(value = 0, message = "Current count cannot be negative")
    Integer currentCount
) {
}
