package com.nforce.retailops.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AddOwnerRequest(
    @NotBlank String ownerName,
    @NotBlank @Email String ownerEmail,
    @NotBlank @Size(min = 8) String password,
    @NotBlank String storeName,
    @NotBlank String storeLocation
) {
}
