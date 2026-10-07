package com.nforce.retailops.dto;

// deleted: the supplier row was removed. Otherwise it had order history and
// was only marked inactive (deactivated = true).
public record SupplierDeleteResponse(boolean deleted, boolean deactivated) {
}
