package com.nforce.retailops.dto;

import jakarta.validation.constraints.Size;

public record AssignStoreRequest(
    @Size(max = 150, message = "Name must be 150 characters or fewer")
    String storeName,

    String storeLocation,

    Long existingStoreId
) {
}
