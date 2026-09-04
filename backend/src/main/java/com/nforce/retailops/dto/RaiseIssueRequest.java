package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record RaiseIssueRequest(
    @NotNull(message = "Store is required")
    Long storeId,

    @NotBlank(message = "Note is required")
    String note
) {
}
