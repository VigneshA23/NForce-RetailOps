package com.nforce.retailops.dto;

import java.util.List;

public record MeResponse(
    Long id,
    String fullName,
    String email,
    String role,
    List<String> storeNames,
    boolean mustResetPassword,
    // Employee-only details for the Profile page; null for owners/super admins,
    // who have no StoreEmployee record to source them from.
    String shift,
    String employeeType,
    String phone
) {
}
