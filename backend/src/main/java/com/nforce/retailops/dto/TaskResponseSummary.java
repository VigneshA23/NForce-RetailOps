package com.nforce.retailops.dto;

import com.nforce.retailops.entity.AdminCorrection;
import com.nforce.retailops.entity.CompletedVia;
import com.nforce.retailops.entity.TaskResponseEntry;

import java.time.OffsetDateTime;

public record TaskResponseSummary(
    Long id,
    Long employeeUserId,
    String employeeFullName,
    Boolean booleanValue,
    Double numericValue,
    String textValue,
    OffsetDateTime respondedAt,
    boolean flaggedNeedsCorrection,
    String flagReason,
    CompletedVia completedVia,
    // Who last flagged/edited this response, and how -- "FLAG_TO_EMPLOYEE" or
    // "DIRECT" (see AdminCorrection.correctionType). Null once this response is
    // replaced by a fresh one (e.g. after the employee resubmits a flagged
    // task), since the correction row still points at the old, now-inactive
    // entry. Powers the employee-facing "Requested to resubmit by <Admin>" /
    // "Response edited by <Admin>" notice -- see EmployeeDashboard.tsx.
    String correctionAdminName,
    String correctionType
) {
    public static TaskResponseSummary from(TaskResponseEntry entry) {
        return from(entry, null);
    }

    public static TaskResponseSummary from(TaskResponseEntry entry, AdminCorrection latestCorrection) {
        String adminName = latestCorrection == null ? null
            : latestCorrection.getCorrectedBy() != null ? latestCorrection.getCorrectedBy().getFullName()
            : latestCorrection.getCorrectedByName();
        return new TaskResponseSummary(
            entry.getId(),
            entry.getEmployee().getId(),
            entry.getEmployee().getFullName(),
            entry.getValueBoolean(),
            entry.getValueNumeric(),
            entry.getValueText(),
            entry.getCreatedAt(),
            entry.isFlaggedNeedsCorrection(),
            entry.getFlagReason(),
            entry.getCompletedVia(),
            adminName,
            latestCorrection == null ? null : latestCorrection.getCorrectionType()
        );
    }
}
