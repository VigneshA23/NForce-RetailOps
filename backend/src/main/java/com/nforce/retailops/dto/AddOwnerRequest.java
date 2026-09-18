package com.nforce.retailops.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record AddOwnerRequest(
    @NotBlank String ownerName,
    @NotBlank @Email String ownerEmail,
    // Country code + 10-digit number, e.g. "+1 5551234567" -- same combined
    // format the Add/Edit Employee form and self-service Profile edit use.
    // Digit-count validation happens client-side (see OwnerFormModal); this
    // mirrors EmployeeCreateRequest.phone, which is likewise unconstrained here.
    @NotBlank String ownerPhone,
    @NotBlank String ownerGender,
    String storeName,
    String storeLocation,
    Long existingStoreId
) {
}
