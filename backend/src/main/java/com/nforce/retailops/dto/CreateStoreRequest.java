package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateStoreRequest(
    @NotBlank(message = "Store name is required")
    @Size(max = 150, message = "Store name must be 150 characters or fewer")
    String name,

    @NotBlank(message = "Store location is required")
    String location
) {
}
