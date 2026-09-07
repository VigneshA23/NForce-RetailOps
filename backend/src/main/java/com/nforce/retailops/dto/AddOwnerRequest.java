package com.nforce.retailops.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record AddOwnerRequest(
    @NotBlank String ownerName,
    @NotBlank @Email String ownerEmail,
    @NotBlank @Pattern(regexp = "\\d{10}", message = "Contact number must be exactly 10 digits") String ownerPhone,
    @NotBlank String ownerGender,
    String storeName,
    String storeLocation,
    Long existingStoreId
) {
}
