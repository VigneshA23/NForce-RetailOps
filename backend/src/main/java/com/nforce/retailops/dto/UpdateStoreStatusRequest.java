package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateStoreStatusRequest(
    @NotNull Boolean active
) {
}
