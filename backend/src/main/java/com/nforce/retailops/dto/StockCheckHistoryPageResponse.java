package com.nforce.retailops.dto;

import java.util.List;

// Shape matches frontend/src/components/Pagination.tsx's props exactly
// (1-indexed page) so the frontend needs no translation layer.
public record StockCheckHistoryPageResponse(
    List<StockCheckResponse> items,
    int page,
    int pageSize,
    int pageCount,
    long totalItems
) {
}
