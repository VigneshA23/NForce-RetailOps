package com.nforce.retailops.dto;

import java.util.List;

// Returned by both the submit and undo endpoints: the resulting current state for
// that task/store/day, so the caller doesn't need a second round trip to know whether
// it can still undo.
public record TaskResponseStateResponse(
    Long taskId,
    List<TaskResponseSummary> responses,
    boolean canUndo
) {
}
