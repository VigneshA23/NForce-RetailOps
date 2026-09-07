package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateIssueStatusRequest(
    @NotBlank @Pattern(regexp = "OPEN|ACKNOWLEDGED|RESOLVED", message = "status must be OPEN, ACKNOWLEDGED, or RESOLVED")
    String status,
    @Size(max = 500) String responseText
) {
}
