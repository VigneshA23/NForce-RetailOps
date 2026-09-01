package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotNull;

public record CategoryStatusRequest(
    @NotNull(message = "Active is required")
    Boolean active
) {
}
