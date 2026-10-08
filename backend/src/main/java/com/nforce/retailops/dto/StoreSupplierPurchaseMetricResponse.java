package com.nforce.retailops.dto;

import java.math.BigDecimal;

// Super Admin's cross-store Supplier Purchasing Summary: a flat list, one row
// per store+supplier pairing with qualifying activity in the requested date
// range. The frontend groups rows by storeId for display -- that's a view
// concern, not a recalculation, since orderEntryCount/totalQuantity already
// arrive pre-aggregated from the database.
public record StoreSupplierPurchaseMetricResponse(
    Long storeId,
    String storeName,
    String supplierName,
    long orderEntryCount,
    BigDecimal totalQuantity
) {
}
