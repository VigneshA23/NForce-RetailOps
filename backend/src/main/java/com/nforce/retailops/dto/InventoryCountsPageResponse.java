package com.nforce.retailops.dto;

import java.util.List;

// allCount/outCount/lowCount/staleCount are over every active item in the
// store, independent of search/category/level filters -- so the KPI tiles
// they back stay stable reference points while rows filters down, the same
// way OrderDashboard's own status tiles work.
public record InventoryCountsPageResponse(
    List<InventoryCountRowResponse> rows,
    int page,
    int size,
    int totalPages,
    long totalElements,
    long allCount,
    long outCount,
    long lowCount,
    long staleCount
) {
}
