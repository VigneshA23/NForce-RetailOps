package com.nforce.retailops.dto;

import java.util.List;

public record MeResponse(
    Long id,
    String fullName,
    String email,
    String role,
    List<String> storeNames,
    boolean mustResetPassword
) {
}
