package com.nforce.retailops.dto;

import java.time.OffsetDateTime;

// One flagged-and-replaced response in a resubmission chain (see
// TaskResponseEntry.supersededResponseId / ChecklistHistoryService.buildResubmissionHistory).
// Field names mirror HistoryResponseEntryResponse's value fields for consistency.
public record ResponseHistoryEntry(
    Long responseId,
    Boolean booleanValue,
    Double numericValue,
    String textValue,
    OffsetDateTime respondedAt,
    String employeeFullName,
    String flagReason,
    String flaggedByName,
    OffsetDateTime flaggedAt,
    // True when this hop was itself deactivated by the employee's own explicit Undo
    // (before being superseded by a later resubmission) -- lets the UI split this
    // hop into "value -> Not done, Undone by X" followed by the normal resubmit
    // transition, instead of collapsing an undo-then-redo cycle into one no-op-looking
    // "value -> same value" line.
    boolean undoneByUser
) {
}
