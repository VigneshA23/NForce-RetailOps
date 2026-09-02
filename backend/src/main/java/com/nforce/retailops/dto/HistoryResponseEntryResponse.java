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
    OffsetDateTime respondedAt
) {
}
