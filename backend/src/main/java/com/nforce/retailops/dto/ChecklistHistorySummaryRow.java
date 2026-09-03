package com.nforce.retailops.dto;

import java.time.LocalDate;

public record ChecklistHistorySummaryRow(
    Long storeId,
    String storeName,
    LocalDate date,
    boolean hasChecklist,
    int totalTasks,
    int completedTasks,
    // Tasks whose latest response that day is a Yes/No task answered "No" -- the
    // same exception/issue definition ChecklistHistoryService.getDetail's
    // frontend consumer (checklistHistoryOptions.taskStatus) already uses.
    int exceptionCount
) {
}
