package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotNull;

public record TaskStatusRequest(
    @NotNull(message = "Active is required")
    Boolean active
) {
}
