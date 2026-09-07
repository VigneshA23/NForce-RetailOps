package com.nforce.retailops.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record UpdateOwnerRequest(
    @NotBlank String ownerName,
    @NotBlank @Email String ownerEmail
) {
}
