package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

// Super Admin's own Add/Edit Supplier form only (RTS-304 follow-up). Kept
// separate from SupplierRequest, which Owner/Admin's rename-only flow
// (StoreController) still uses unchanged -- that flow never sends
// contact/location/store-assignment fields, so it must not be forced through
// the stricter store-selection validation this request's fields imply.
public record SupplierDetailsRequest(
    @NotBlank(message = "Name is required")
    @Size(max = 150, message = "Name must be 150 characters or fewer")
    String name,

    @Size(max = 20, message = "Contact must be 20 characters or fewer")
    String contact,

    @Size(max = 255, message = "Location must be 255 characters or fewer")
    String location,

    boolean appliesToAllStores,

    List<Long> storeIds
) {
}
