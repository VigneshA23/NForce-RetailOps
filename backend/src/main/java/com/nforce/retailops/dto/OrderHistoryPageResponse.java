package com.nforce.retailops.dto;

import java.util.List;

// awaitingReceiptCount/receivedCount are over every row matching the date
// range/supplier/search filters, independent of pagination -- the same
// "stable reference point while rows page through" convention
// InventoryCountsPageResponse's own KPI counts follow.
public record OrderHistoryPageResponse(
    List<OrderHistoryEntryResponse> rows,
    int page,
    int size,
    int totalPages,
    long totalElements,
    long awaitingReceiptCount,
    long receivedCount
) {
}
