package com.nforce.retailops.dto;

import java.util.List;

public record HistoryCategoryResponse(
    Long id,
    String name,
    // The category's Super Admin badge color (drives its icon tile color).
    String badgeColor,
    List<HistoryTaskItemResponse> tasks
) {
}
