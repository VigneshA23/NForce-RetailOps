package com.nforce.retailops.dto;

import java.time.OffsetDateTime;

public record StoreOperationsSummaryResponse(
    Long storeId,
    String storeName,
    String ownerName,
    int totalTasks,
    int completedTasks,
    int completionPercent,
    long openIssues,
    OffsetDateTime lastActivityAt
) {}
