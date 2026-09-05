package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record RaiseIssueRequest(
    @NotNull @Positive Long storeId,
    @NotBlank @Size(max = 1000) String note
) {
}
