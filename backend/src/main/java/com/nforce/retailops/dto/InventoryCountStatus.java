package com.nforce.retailops.dto;

// A row's live status on the Inventory Counts view. STALE wins over
// OUT/LOW -- an item not counted today needs a recount before its
// out-of-stock/below-minimum state can be trusted.
public enum InventoryCountStatus {
    OUT_OF_STOCK,
    LOW,
    STALE,
    HEALTHY
}
