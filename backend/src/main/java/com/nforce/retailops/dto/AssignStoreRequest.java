package com.nforce.retailops.dto;

import jakarta.validation.constraints.Size;

public record AssignStoreRequest(
    @Size(max = 150, message = "Name must be 150 characters or fewer")
    String storeName,

    String storeLocation,

    // Set instead of storeName/storeLocation to assign an existing unassigned
    // store rather than creating a new one -- mirrors AddOwnerRequest.
    Long existingStoreId
) {
}
