package com.nforce.retailops.dto;

import java.util.List;

// The Owner-facing, cross-owner employee directory used to find an existing
// (Super-Admin-created) employee and assign them to the caller's own store --
// unlike SuperAdminEmployeeResponse, this deliberately omits owner
// attribution, since an owner has no business seeing who else manages a
// given store.
public record EmployeeDirectoryResponse(
    Long id,
    String empId,
    String name,
    String email,
    String phone,
    List<StoreOptionResponse> stores,
    boolean assignedToMyStore
) {
}
