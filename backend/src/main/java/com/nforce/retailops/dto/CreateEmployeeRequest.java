package com.nforce.retailops.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateEmployeeRequest(
    @NotBlank String fullName,
    @NotBlank @Email String email,
    @NotBlank @Size(min = 8) String password,
    @NotBlank String phone,
    @NotBlank String shift,
    @NotBlank String employmentType,
    @NotBlank String gender,
    @NotNull Long storeId
) {
}
