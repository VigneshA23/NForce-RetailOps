package com.nforce.retailops.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record EmployeeCreateRequest(
    @NotBlank(message = "Name is required")
    @Size(max = 150, message = "Name must be 150 characters or fewer")
    String name,

    @NotBlank(message = "Email is required")
    @Email(message = "Enter a valid email address")
    String email,

    @NotBlank(message = "Contact number is required")
    String phone,

    @NotBlank(message = "Shift is required")
    String shift,

    @NotBlank(message = "Employment type is required")
    String employeeType,

    @NotBlank(message = "Gender is required")
    String gender,

    // Optional initial store assignments (Super Admin creation path only).
    // Null or empty = no stores assigned; the employee can be picked up later
    // via the owner assign/unassign endpoints.
    List<Long> storeIds
) {
}
