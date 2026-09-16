package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;

// No @Email format validation here, for the same reason as LoginRequest: a
// leading/trailing-whitespace email must reach PasswordResetService.requestReset()
// and be silently rejected there, rather than short-circuiting on a distinct
// validation-error response.
public record ForgotPasswordRequest(
    @NotBlank String email
) {}
