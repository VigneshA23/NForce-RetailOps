package com.nforce.retailops.dto;

import com.nforce.retailops.entity.ActivityLog;

import java.time.OffsetDateTime;

public record ActivityLogEntryResponse(
    Long id,
    String actionType,
    String actorName,
    String actorRole,
    String storeName,
    String entityType,
    String entityName,
    String description,
    OffsetDateTime occurredAt
) {
    public static ActivityLogEntryResponse from(ActivityLog log) {
        return new ActivityLogEntryResponse(
            log.getId(),
            log.getActionType(),
            log.getActorName(),
            log.getActorRole(),
            log.getStoreName(),
            log.getEntityType(),
            log.getEntityName(),
            log.getDescription(),
            log.getOccurredAt()
        );
    }
}
