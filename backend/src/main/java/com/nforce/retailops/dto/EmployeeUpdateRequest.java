package com.nforce.retailops.dto;

import com.nforce.retailops.validation.ValidEmail;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Store assignment is handled separately (EmployeeController assign/unassign
// endpoints), not through this edit form -- an employee's stores can span
// several owners, so a per-owner edit must never be able to replace the
// whole set.
public record EmployeeUpdateRequest(
    @NotBlank(message = "Name is required")
    @Size(max = 150, message = "Name must be 150 characters or fewer")
    String name,

    @NotBlank(message = "Email is required")
    @ValidEmail
    String email,

    @NotBlank(message = "Contact number is required")
    String phone,

    @NotBlank(message = "Employment type is required")
    String employeeType,

    @NotBlank(message = "Gender is required")
    String gender
) {
}
