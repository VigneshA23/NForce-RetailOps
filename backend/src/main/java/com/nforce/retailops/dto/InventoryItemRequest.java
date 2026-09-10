package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record InventoryItemRequest(
    @NotNull(message = "Category is required")
    Long categoryId,

    @NotBlank(message = "Name is required")
    @Size(max = 150, message = "Name must be 150 characters or fewer")
    String name,

    @NotBlank(message = "Unit of measurement is required")
    @Size(max = 40, message = "Unit must be 40 characters or fewer")
    String unitOfMeasurement
) {
}
