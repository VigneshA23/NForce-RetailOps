package com.nforce.retailops.dto;

import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.ScheduleType;

import java.time.OffsetDateTime;
import java.util.List;

public record HistoryTaskItemResponse(
    Long id,
    String name,
    String description,
    ResponseType responseType,
    CompletionType completionType,
    ScheduleType scheduleType,
    String numericUnit,
    boolean completed,
    // Whether this task is still active in the owner's current configuration --
    // false means it's since been deactivated/reconfigured, but it still shows up
    // here because it has real historical responses (see ChecklistHistoryService's
    // eligible-tasks-union-responded-tasks reconstruction).
    boolean currentlyActive,
    // Active-employee headcount for the store this task belongs to -- the "Y" in
    // "X of Y responded", matching the Employee checklist's own denominator
    // (TaskChecklistItemResponse.totalActiveEmployees).
    int totalActiveEmployees,
    // Deactivation audit, resolved from ActivityLog by entity name + store
    // (best-effort -- see ChecklistHistoryService). Null when currentlyActive is
    // true, or no matching TASK_DEACTIVATED log row could be found.
    String deactivatedByName,
    OffsetDateTime deactivatedAt,
    List<HistoryResponseEntryResponse> responses
) {
}
