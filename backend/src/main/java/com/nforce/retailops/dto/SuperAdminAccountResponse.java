package com.nforce.retailops.dto;

import com.nforce.retailops.entity.SuperAdmin;

// One Super Admin account as listed for revocation. No password hash, phone
// or avatar -- only what's needed to pick an account and see its status.
public record SuperAdminAccountResponse(
    Long id,
    String name,
    String email,
    boolean active
) {
    public static SuperAdminAccountResponse from(SuperAdmin superAdmin) {
        return new SuperAdminAccountResponse(
            superAdmin.getId(), superAdmin.getName(), superAdmin.getEmail(), superAdmin.isActive());
    }
}
