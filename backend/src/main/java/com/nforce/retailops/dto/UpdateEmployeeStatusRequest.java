package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateEmployeeStatusRequest(
    @NotNull Boolean active
) {
}
