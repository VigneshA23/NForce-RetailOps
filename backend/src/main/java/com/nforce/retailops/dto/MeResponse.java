package com.nforce.retailops.dto;

import java.util.List;

public record MeResponse(
    Long id,
    String fullName,
    String email,
    String role,
    List<String> storeNames,
    boolean mustResetPassword,
    // Employee-only detail for the Profile page; null for owners/super admins,
    // who have no StoreEmployee record to source it from.
    String employeeType,
    // Self-service phone number, for every role (see UpdateMeRequest).
    String phone,
    // Base64-encoded profile photo (data: URL). Null when not set.
    String avatarUrl
) {
}
