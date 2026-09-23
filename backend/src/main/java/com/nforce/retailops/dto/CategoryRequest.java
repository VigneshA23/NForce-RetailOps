package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CategoryRequest(
    @NotBlank(message = "Name is required")
    @Size(max = 100, message = "Name must be 100 characters or fewer")
    String name,

    boolean appliesToAllStores,

    List<Long> storeIds,

    // Optional: null keeps the current color (edit) or defaults to blue (create).
    @Pattern(regexp = "red|green|amber|blue|purple|slate", message = "Invalid badge color")
    String badgeColor,

    // Create only: false makes the category go live from tomorrow instead of today.
    // Null is treated as true.
    Boolean enableImmediately
) {
    public CategoryRequest(String name, boolean appliesToAllStores, List<Long> storeIds) {
        this(name, appliesToAllStores, storeIds, null, null);
    }
}
