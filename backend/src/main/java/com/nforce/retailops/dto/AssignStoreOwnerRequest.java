package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotNull;

public record AssignStoreOwnerRequest(
    @NotNull(message = "Owner ID is required")
    Long ownerId
) {
}
