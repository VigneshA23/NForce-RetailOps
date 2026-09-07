package com.nforce.retailops.dto;

public record PlatformStatsResponse(
    int platformCompletionPercent,
    long totalOpenIssues,
    int totalStores,
    int storesWithActivity
) {}
