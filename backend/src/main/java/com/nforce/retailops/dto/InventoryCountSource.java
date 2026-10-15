package com.nforce.retailops.dto;

// How an Inventory Counts entry was made: a Start of Day or End of Day count,
// a delivery (an order marked Received), or a mid-day shortage report.
public enum InventoryCountSource {
    START_OF_DAY,
    END_OF_DAY,
    STOCK_RECEIVED,
    SHORTAGE_REPORT
}
