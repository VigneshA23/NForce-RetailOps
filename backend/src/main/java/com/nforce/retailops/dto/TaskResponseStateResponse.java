package com.nforce.retailops.dto;

import java.time.LocalDate;
import java.util.List;

// Returned by both the submit and undo endpoints: the resulting current state for
// that task/store/day, so the caller doesn't need a second round trip to know whether
// it can still undo -- including a refreshed "X/Y Completed By" count so the badge
// stays correct without a full checklist reload.
//
// originalDueDate: null for a normal (today) unit, otherwise the moved unit's original
// due date -- lets the caller match this state update back to the correct unit when a
// task has multiple independent units sharing the same taskId (see
// frontend checklistUnitKey / EmployeeDashboard.applyTaskState).
public record TaskResponseStateResponse(
    Long taskId,
    List<TaskResponseSummary> responses,
    boolean canUndo,
    int completedByCount,
    int totalActiveEmployees,
    List<String> completedByNames,
    LocalDate originalDueDate
) {
}
