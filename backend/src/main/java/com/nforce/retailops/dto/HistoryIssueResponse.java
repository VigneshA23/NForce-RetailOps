package com.nforce.retailops.dto;

import com.nforce.retailops.entity.RaisedIssue;

import java.time.OffsetDateTime;

// Employee-facing shape, embedded in ChecklistHistoryDetailResponse -- already
// scoped to one employee/store/date by the containing response, so it omits
// the identity fields IssueResponse (the owner-facing shape) needs.
public record HistoryIssueResponse(
    Long id,
    String note,
    String status,
    String responseText,
    String respondedByName,
    OffsetDateTime respondedAt,
    OffsetDateTime createdAt
) {
    public static HistoryIssueResponse from(RaisedIssue issue) {
        return new HistoryIssueResponse(
            issue.getId(),
            issue.getNote(),
            issue.getStatus().name(),
            issue.getResponseText(),
            issue.getRespondedBy() != null ? issue.getRespondedBy().getFullName() : null,
            issue.getRespondedAt(),
            issue.getCreatedAt()
        );
    }
}
