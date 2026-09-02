package com.nforce.retailops.dto;

import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.ResponseType;

import java.util.List;

public record HistoryTaskItemResponse(
    Long id,
    String name,
    String description,
    ResponseType responseType,
    CompletionType completionType,
    boolean completed,
    // Whether this task is still active in the owner's current configuration --
    // false means it's since been deactivated/reconfigured, but it still shows up
    // here because it has real historical responses (see ChecklistHistoryService's
    // eligible-tasks-union-responded-tasks reconstruction).
    boolean currentlyActive,
    List<HistoryResponseEntryResponse> responses
) {
}
