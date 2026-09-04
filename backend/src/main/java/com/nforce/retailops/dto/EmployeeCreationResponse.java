package com.nforce.retailops.dto;

// Only ever returned from the create endpoint, never from a list/update --
// the plaintext temporary password exists in memory for exactly this one
// response, right after it was generated and hashed.
public record EmployeeCreationResponse(
    EmployeeResponse employee,
    String temporaryPassword
) {
}
