package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Raising or editing a flag on a cash entry. Comment is required (at least
// one non-blank character).
public record SuperAdminCashFlagRequest(
    @NotBlank
    @Size(max = 2000)
    String comment
) {
}
