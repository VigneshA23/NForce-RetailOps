package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record InventoryUnitRequest(
        @NotBlank(message = "Unit name is required")
        @Size(max = 30, message = "Unit name must be at most 30 characters")
        String name,
        @NotNull(message = "Choose whole number or decimal")
        Boolean wholeNumber) {
}
