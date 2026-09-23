package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

// Exactly one of the three value fields is expected, chosen by the task's configured
// responseType (YES_NO/DONE_NOT_DONE -> booleanValue, NUMERIC -> numericValue,
// TEXT -> textValue); TaskService validates the match, not bean validation, since the
// required field depends on the referenced task.
//
// originalDueDate: null for a normal submission (today's own scheduled occurrence).
// Non-null identifies this submission as completing a moved unit -- the instance
// (taskId, storeId, originalDueDate) must have a live PENDING move targeting today
// (TaskService.submitResponse/TaskMakeupLinkService.requirePendingMoveTargeting); the
// resulting response is attributed to originalDueDate, not today.
public record TaskResponseSubmitRequest(
    @NotNull(message = "Store is required")
    Long storeId,

    Boolean booleanValue,
    Double numericValue,
    String textValue,
    LocalDate originalDueDate
) {
}
