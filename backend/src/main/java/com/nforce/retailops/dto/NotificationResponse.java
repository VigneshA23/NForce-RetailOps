package com.nforce.retailops.dto;

import com.nforce.retailops.entity.Notification;

import java.time.OffsetDateTime;

public record NotificationResponse(
    Long id,
    String title,
    String message,
    String category,
    String priority,
    boolean read,
    String linkPath,
    Long relatedIssueId,
    String relatedIssueNote,
    String relatedStoreName,
    String relatedIssueStatus,
    OffsetDateTime createdAt
) {
    public static NotificationResponse from(Notification n) {
        Long issueId = null;
        String issueNote = null;
        String storeName = null;
        String issueStatus = null;

        if (n.getRelatedIssue() != null) {
            issueId = n.getRelatedIssue().getId();
            issueNote = n.getRelatedIssue().getNote();
            storeName = n.getRelatedIssue().getStore().getName();
            issueStatus = n.getRelatedIssue().getStatus();
        }

        return new NotificationResponse(
            n.getId(),
            n.getTitle(),
            n.getMessage(),
            n.getCategory(),
            n.getPriority(),
            n.isRead(),
            n.getLinkPath(),
            issueId,
            issueNote,
            storeName,
            issueStatus,
            n.getCreatedAt()
        );
    }
}
