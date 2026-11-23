package com.nforce.retailops.dto;

import com.nforce.retailops.validation.ValidEmail;
import jakarta.validation.constraints.NotBlank;

public record UpdateOwnerRequest(
    @NotBlank String ownerName,
    @NotBlank @ValidEmail String ownerEmail
) {
}
