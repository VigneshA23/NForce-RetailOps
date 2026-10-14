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
    Long storeId,
    OffsetDateTime createdAt,
    StockReceiptRequestResponse receiptRequest
) {
    public static NotificationResponse from(Notification n) {
        Long issueId = null;
        String issueNote = null;
        String storeName = n.getStore() != null ? n.getStore().getName() : null;
        Long storeId = n.getStore() != null ? n.getStore().getId() : null;
        String issueStatus = null;

        if (n.getRelatedIssue() != null) {
            issueId = n.getRelatedIssue().getId();
            issueNote = n.getRelatedIssue().getNote();
            if (storeName == null) {
                storeName = n.getRelatedIssue().getStore().getName();
            }
            if (storeId == null) {
                storeId = n.getRelatedIssue().getStore().getId();
            }
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
            storeId,
            n.getCreatedAt(),
            n.getStockReceiptRequest() != null ? StockReceiptRequestResponse.from(n.getStockReceiptRequest()) : null
        );
    }
}
