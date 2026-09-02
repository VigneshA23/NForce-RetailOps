package com.nforce.retailops.dto;

import java.util.List;

// Returned by both the submit and undo endpoints: the resulting current state for
// that task/store/day, so the caller doesn't need a second round trip to know whether
// it can still undo -- including a refreshed "X/Y Completed By" count so the badge
// stays correct without a full checklist reload.
public record TaskResponseStateResponse(
    Long taskId,
    List<TaskResponseSummary> responses,
    boolean canUndo,
    int completedByCount,
    int totalActiveEmployees,
    List<String> completedByNames
) {
}
