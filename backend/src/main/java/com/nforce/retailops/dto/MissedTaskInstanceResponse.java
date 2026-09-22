package com.nforce.retailops.dto;

import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.ResponseType;

import java.time.LocalDate;

// One missed (task, date) instance on the employee's Missed Tasks page. The server
// computes every button's eligibility up front -- the frontend just renders `state`.
public record MissedTaskInstanceResponse(
    Long taskId,
    String taskName,
    String description,
    ResponseType responseType,
    String responseNote,
    String numericUnit,
    Double numericMin,
    Double numericMax,
    Integer textMaxLength,
    CompletionType completionType,
    LocalDate date,
    // ACTIONABLE: Complete Now (and, if canCompleteWithToday, Complete with Today)
    // are available. LINKED: already linked to today, no buttons (except Unlink for
    // the link's creator). WAITING_ON_SECOND: a MULTIPLE task the current employee
    // already answered, awaiting a second distinct employee -- no buttons.
    String state,
    int completedByCount,
    int totalActiveEmployees,
    boolean canCompleteWithToday,
    boolean canUnlink,
    LocalDate linkedDate
) {
}
