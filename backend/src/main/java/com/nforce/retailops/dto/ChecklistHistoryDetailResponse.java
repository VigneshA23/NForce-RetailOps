package com.nforce.retailops.dto;

import java.time.LocalDate;
import java.util.List;

public record ChecklistHistoryDetailResponse(
    Long storeId,
    String storeName,
    LocalDate date,
    boolean hasChecklist,
    List<HistoryCategoryResponse> categories
) {
}
