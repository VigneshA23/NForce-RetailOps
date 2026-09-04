package com.nforce.retailops.dto;

import java.time.LocalDate;
import java.util.List;

public record ChecklistHistoryDetailResponse(
    Long storeId,
    String storeName,
    LocalDate date,
    boolean hasChecklist,
    List<HistoryCategoryResponse> categories,
    // Employee-facing only (MeHistoryService) -- the owner-facing equivalent
    // (ChecklistHistoryService) always passes an empty list here; issues are
    // surfaced to owners separately via IssueController/StoreDetail instead.
    List<HistoryIssueResponse> issues
) {
}
