package com.nforce.retailops.dto;

public record LoginResponse(
    String token,
    String role,
    String fullName,
    boolean mustResetPassword
) {
}
