package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record StoreRequest(
    @NotBlank(message = "Name is required")
    @Size(max = 150, message = "Name must be 150 characters or fewer")
    String name,

    // Optional so the existing name-only rename call keeps working; when
    // present, it updates the store's location too.
    String location
) {
}
