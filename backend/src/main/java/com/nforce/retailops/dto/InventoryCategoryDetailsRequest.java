package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

// Super Admin's own Add/Edit Category form, mirroring SupplierDetailsRequest.
public record InventoryCategoryDetailsRequest(
    @NotBlank(message = "Name is required")
    @Size(max = 150, message = "Name must be 150 characters or fewer")
    String name,

    boolean appliesToAllStores,

    List<Long> storeIds
) {
}
