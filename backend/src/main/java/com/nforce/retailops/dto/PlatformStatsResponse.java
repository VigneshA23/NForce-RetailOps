package com.nforce.retailops.dto;

public record PlatformStatsResponse(
    int platformCompletionPercent,
    long totalOpenIssues,
    int totalStores,
    int storesWithActivity,
    int totalTasksToday,
    int completedTasksToday,
    int totalEmployees,
    int employeesActiveToday,
    int storesWithOpenIssues,
    int totalOwners,
    int ownersLoggedInToday
) {}
