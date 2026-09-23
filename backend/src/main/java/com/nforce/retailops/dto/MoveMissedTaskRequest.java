package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record MoveMissedTaskRequest(
    @NotNull(message = "Target date is required")
    LocalDate targetDate
) {
}
