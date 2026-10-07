package com.nforce.retailops.dto;

import java.util.List;

// Super Admin's cross-store stock-check history (RTS-305). Same shape as
// StockCheckHistoryPageResponse, wrapping the store-labelled row type instead.
public record SuperAdminStockCheckHistoryPageResponse(
    List<SuperAdminStockCheckResponse> items,
    int page,
    int pageSize,
    int pageCount,
    long totalItems
) {
}
