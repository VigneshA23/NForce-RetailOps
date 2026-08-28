package com.nforce.retailops.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record EmployeeUpdateRequest(
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

    @NotEmpty(message = "At least one store must be assigned")
    List<Long> storeIds
) {
}
