package com.nforce.retailops.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record AddOwnerRequest(
    @NotBlank String ownerName,
    @NotBlank @Email String ownerEmail,
    @NotBlank String ownerPhone,
    @NotBlank String ownerGender,
    String storeName,
    String storeLocation,
    Long existingStoreId
) {
}
