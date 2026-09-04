package com.nforce.retailops.dto;

import com.nforce.retailops.entity.RaisedIssue;

import java.time.OffsetDateTime;

// Owner-facing shape (list + respond) -- carries the raiser's identity, unlike
// HistoryIssueResponse which is already scoped to one employee by context.
public record IssueResponse(
    Long id,
    Long storeId,
    Long employeeUserId,
    String employeeName,
    String note,
    String status,
    String responseText,
    String respondedByName,
    OffsetDateTime respondedAt,
    OffsetDateTime createdAt
) {
    public static IssueResponse from(RaisedIssue issue) {
        return new IssueResponse(
            issue.getId(),
            issue.getStore().getId(),
            issue.getEmployee().getId(),
            issue.getEmployee().getFullName(),
            issue.getNote(),
            issue.getStatus().name(),
            issue.getResponseText(),
            issue.getRespondedBy() != null ? issue.getRespondedBy().getFullName() : null,
            issue.getRespondedAt(),
            issue.getCreatedAt()
        );
    }
}
