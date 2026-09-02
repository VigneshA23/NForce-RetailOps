package com.nforce.retailops.dto;

import java.time.LocalDate;

public record ChecklistHistorySummaryRow(
    Long storeId,
    String storeName,
    LocalDate date,
    boolean hasChecklist,
    int totalTasks,
    int completedTasks
) {
}
