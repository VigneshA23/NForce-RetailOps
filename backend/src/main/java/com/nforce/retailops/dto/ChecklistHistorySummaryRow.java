package com.nforce.retailops.dto;

import java.time.LocalDate;

public record ChecklistHistorySummaryRow(
    Long storeId,
    String storeName,
    LocalDate date,
    boolean hasChecklist,
    int totalTasks,
    int completedTasks,
    // Tasks whose latest response that day has been explicitly flagged by an
    // admin/super-admin for correction -- the same Issue definition
    // ChecklistHistoryService.getDetail's frontend consumer
    // (checklistHistoryOptions.taskStatus) already uses.
    int issueCount
) {
}
