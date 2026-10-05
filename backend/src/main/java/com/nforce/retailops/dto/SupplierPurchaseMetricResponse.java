package com.nforce.retailops.dto;

// Owner/Admin's Supplier Purchasing Summary: one supplier's purchasing
// activity, for their own store, over the requested date range.
public record SupplierPurchaseMetricResponse(
    String supplierName,
    long orderEntryCount,
    long totalQuantity
) {
}
