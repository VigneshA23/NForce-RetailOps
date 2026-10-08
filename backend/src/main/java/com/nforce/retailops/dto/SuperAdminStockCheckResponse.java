package com.nforce.retailops.dto;

// One item's stock record for one business day, labelled with its store
// (RTS-305) -- wraps the existing, unchanged StockCheckResponse (also used
// by Owner/Admin and Employee endpoints) rather than adding a store field to
// it directly. Returned the same way whether the caller scoped to one store
// or asked for every store, so the frontend has one shape to handle either
// way.
public record SuperAdminStockCheckResponse(
    Long storeId,
    String storeName,
    StockCheckResponse check
) {
}
