package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;

// No @Email format validation here: a leading/trailing-whitespace email must reach
// AuthService.login() and fail there with the generic "Invalid email or password"
// message, rather than short-circuiting on a distinct validation-error response
// that would reveal the raw input was malformed.
public record LoginRequest(
    @NotBlank String email,
    @NotBlank String password,
    boolean rememberMe
) {
}
