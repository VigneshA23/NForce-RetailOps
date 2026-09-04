package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;

public record RespondIssueRequest(
    @NotBlank(message = "Response is required")
    String responseText
) {
}
