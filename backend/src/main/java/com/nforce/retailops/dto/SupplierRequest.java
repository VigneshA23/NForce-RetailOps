package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SupplierRequest(
    @NotBlank(message = "Name is required")
    @Size(max = 150, message = "Name must be 150 characters or fewer")
    String name,

    // Only read by the inline "Add New Supplier" quick-add (findOrCreateSupplier)
    // when the caller is Super Admin, which has no implicit own store the way
    // Owner/Admin does -- it names whichever store's inventory item form the
    // supplier was created from. Ignored everywhere else (rename-only update,
    // Owner/Admin's own quick-add, which resolves its store server-side).
    Long storeId
) {
}
