package com.nforce.retailops.dto;

import java.time.OffsetDateTime;

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
    AdminCorrectionEntry latestCorrection
) {
}
