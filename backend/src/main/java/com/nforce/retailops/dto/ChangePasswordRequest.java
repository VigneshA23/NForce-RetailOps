package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// For an authenticated user changing their own password, given they already know
// the current one -- distinct from ResetPasswordRequest, which backs the forced
// first-login flow and does not verify a current password at all.
public record ChangePasswordRequest(
    @NotBlank(message = "Current password is required")
    String currentPassword,

    @NotBlank(message = "New password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    String newPassword
) {
}
