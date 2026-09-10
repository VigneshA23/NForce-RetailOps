package com.nforce.retailops.dto;

// Owner/Admin's configuration of an already-assigned store item. minWeekend
// is intentionally nullable -- null means "use minWeekday for weekends too".
public record StoreInventoryItemConfigRequest(
    Integer minWeekday,
    Integer minWeekend,
    Long preferredSupplierId
) {
}
