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
    OffsetDateTime createdAt
) {
    public static NotificationResponse from(Notification notification) {
        return new NotificationResponse(
            notification.getId(),
            notification.getTitle(),
            notification.getMessage(),
            notification.getCategory().name(),
            notification.getPriority().name(),
            notification.isRead(),
            notification.getCreatedAt()
        );
    }
}
