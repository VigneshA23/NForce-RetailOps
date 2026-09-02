package com.nforce.retailops.dto;

import com.nforce.retailops.entity.TaskResponseEntry;

import java.time.OffsetDateTime;

public record TaskResponseSummary(
    Long id,
    Long employeeUserId,
    String employeeFullName,
    Boolean booleanValue,
    Double numericValue,
    String textValue,
    OffsetDateTime respondedAt
) {
    public static TaskResponseSummary from(TaskResponseEntry entry) {
        return new TaskResponseSummary(
            entry.getId(),
            entry.getEmployee().getId(),
            entry.getEmployee().getFullName(),
            entry.getValueBoolean(),
            entry.getValueNumeric(),
            entry.getValueText(),
            entry.getCreatedAt()
        );
    }
}
