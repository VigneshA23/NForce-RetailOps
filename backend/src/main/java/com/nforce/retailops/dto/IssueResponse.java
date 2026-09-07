package com.nforce.retailops.dto;

import com.nforce.retailops.entity.RaisedIssue;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record IssueResponse(
    Long id,
    Long storeId,
    String storeName,
    Long employeeUserId,
    String employeeFullName,
    String note,
    String status,
    LocalDate raisedDate,
    String responseText,
    String respondedByFullName,
    OffsetDateTime respondedAt,
    OffsetDateTime createdAt
) {
    public static IssueResponse from(RaisedIssue issue) {
        return new IssueResponse(
            issue.getId(),
            issue.getStore().getId(),
            issue.getStore().getName(),
            issue.getEmployeeUser().getId(),
            issue.getEmployeeUser().getFullName(),
            issue.getNote(),
            issue.getStatus(),
            issue.getRaisedDate(),
            issue.getResponseText(),
            issue.getRespondedByUser() != null ? issue.getRespondedByUser().getFullName() : null,
            issue.getRespondedAt(),
            issue.getCreatedAt()
        );
    }
}
