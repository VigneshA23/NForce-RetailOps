package com.nforce.retailops.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record StoreRequest(
    @NotBlank(message = "Name is required")
    @Size(max = 150, message = "Name must be 150 characters or fewer")
    String name,

    // Optional so the existing name-only rename call keeps working; when
    // present, it updates the store's location too.
    String location,

    // Optional for the same reason (the Super Admin edit form always sends
    // it); when present, the store's cash target is updated in the same
    // transaction as the name/location.
    @DecimalMin(value = "0", message = "Cash target cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Cash target: use at most 2 decimal places")
    BigDecimal cashTarget
) {
}
