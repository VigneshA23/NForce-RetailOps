package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateOwnerStatusRequest(
    @NotNull Boolean active
) {
}
