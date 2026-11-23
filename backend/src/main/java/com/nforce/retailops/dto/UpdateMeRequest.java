package com.nforce.retailops.dto;

import com.nforce.retailops.validation.ValidEmail;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Self-service profile edit. `phone` is optional and persisted for every
// role: on the StoreEmployee record for employees, directly on User for
// owners, and on SuperAdmin for super admins.
public record UpdateMeRequest(
    @NotBlank(message = "Full name is required")
    @Size(max = 150, message = "Name must be 150 characters or fewer")
    String fullName,

    @NotBlank(message = "Email is required")
    @ValidEmail
    String email,

    String phone
) {
}
