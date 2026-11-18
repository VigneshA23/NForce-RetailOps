package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Raising or editing a flag on a cash entry. Comment is required and must
// hold at least five words (whitespace-separated); the finer word-count
// rule is enforced in the service so the message is friendly.
public record SuperAdminCashFlagRequest(
    @NotBlank
    @Size(max = 2000)
    String comment
) {
}
