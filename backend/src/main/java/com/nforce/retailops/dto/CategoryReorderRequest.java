package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record CategoryReorderRequest(
    @NotEmpty(message = "orderedIds is required")
    List<Long> orderedIds
) {
}
