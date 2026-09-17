package com.nforce.retailops.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record HistoryResponseEntryResponse(
    Long id,
    Long employeeUserId,
    String employeeFullName,
    String empId,
    Boolean booleanValue,
    Double numericValue,
    String textValue,
    OffsetDateTime respondedAt,
    // Non-null when an admin has corrected this response at least once.
    // Contains metadata about the most recent correction for inline display.
    AdminCorrectionEntry latestCorrection,
    String employeeAvatarUrl,
    boolean flaggedNeedsCorrection,
    String flagReason,
    // Oldest-first chain of flagged responses this one superseded via a
    // flag -> resubmit cycle (see TaskResponseEntry.supersededResponseId).
    // Empty when this response has never replaced a flagged one.
    List<ResponseHistoryEntry> resubmissionHistory,
    // True only for a dangling entry synthesized because the employee explicitly
    // Undid this response and never resubmitted since (so it's no longer active,
    // yet is still the most recent thing that happened for this task/employee
    // today) -- every normally-active response is always false here. The value
    // fields above still carry the response's real pre-undo value; the frontend
    // uses this flag to display "Not done"/"No"/no-answer instead.
    boolean undone
) {
}
