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
    OffsetDateTime flaggedAt
) {
}
