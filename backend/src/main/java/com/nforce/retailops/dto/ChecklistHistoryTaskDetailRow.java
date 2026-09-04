package com.nforce.retailops.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

// One row per task completion event (or one row for a still-pending task) for the
// Daily Operations Summary's task-level detail (CSV export / Print), reusing the
// same eligible-tasks-union-responded-tasks reconstruction and Issue definition
// as ChecklistHistoryService.getSummary/getDetail -- no separate business rule.
public record ChecklistHistoryTaskDetailRow(
    Long storeId,
    String storeName,
    LocalDate date,
    String categoryName,
    String taskName,
    // "COMPLETED" | "NOT_COMPLETED" | "ISSUE"
    String status,
    String response,
    String employeeFullName,
    OffsetDateTime completedAt
) {
}
