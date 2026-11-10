package com.nforce.retailops.entity;

/** Which table a session's subject lives in: users rows vs. the separate super_admins table. */
public enum PrincipalType {
    USER,
    SUPER_ADMIN
}
