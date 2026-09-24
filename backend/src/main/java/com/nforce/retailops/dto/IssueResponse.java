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
    // True when the responder was a Super Admin rather than the store's owner,
    // so the UI can label the response accordingly.
    boolean respondedBySuperAdmin,
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
            respondedByName(issue),
            issue.getRespondedBySuperAdmin() != null,
            issue.getRespondedAt(),
            issue.getCreatedAt()
        );
    }

    // Owner (users row) or Super Admin (own identity table) -- whichever
    // made the last status change. Null while the issue is untouched.
    static String respondedByName(RaisedIssue issue) {
        if (issue.getRespondedByUser() != null) return issue.getRespondedByUser().getFullName();
        if (issue.getRespondedBySuperAdmin() != null) return issue.getRespondedBySuperAdmin().getName();
        return null;
    }
}
