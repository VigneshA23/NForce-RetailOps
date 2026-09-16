package com.nforce.retailops.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

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
    // "COMPLETED" | "NOT_COMPLETED" | "ISSUE" | "INACTIVE" (task or its category is
    // currently deactivated in store config, with no response of its own that day)
    String status,
    String response,
    String employeeFullName,
    OffsetDateTime completedAt,
    // Newest-first full change trail for this row's response (DIRECT correction,
    // FLAG_TO_EMPLOYEE + RESUBMISSION, or UNDONE), the same shape the History
    // page's "View response history" panel shows -- empty when the response has
    // never changed, or for a row with no response at all (NOT_COMPLETED/INACTIVE).
    List<AdminCorrectionEntry> correctionHistory,
    // Needed (alongside numericUnit) to format correctionHistory's before/after
    // values the same way CorrectionModal.tsx does (Yes/No vs Done/Not done vs a
    // unit-suffixed number) -- this row otherwise carries no task-type info.
    String responseType,
    String numericUnit
) {
}
