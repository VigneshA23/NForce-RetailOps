package com.nforce.retailops.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Self-service profile edit. `phone` is only persisted for callers with a
// StoreEmployee record (i.e. employees) -- owners/super admins have none, so
// it's silently ignored for them rather than rejected.
public record UpdateMeRequest(
    @NotBlank(message = "Full name is required")
    @Size(max = 150, message = "Name must be 150 characters or fewer")
    String fullName,

    @NotBlank(message = "Email is required")
    @Email(message = "Enter a valid email address")
    String email,

    @NotBlank(message = "Mobile number is required")
    String phone
) {
}
