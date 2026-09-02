package com.nforce.retailops.dto;

import java.util.List;

public record HistoryCategoryResponse(
    Long id,
    String name,
    List<HistoryTaskItemResponse> tasks
) {
}
