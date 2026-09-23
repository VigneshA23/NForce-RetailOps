package com.nforce.retailops.dto;

import java.time.LocalDate;

public record MissedTaskMoveResponse(
    Long taskId,
    LocalDate originalDueDate,
    LocalDate targetDate,
    String status
) {
}
