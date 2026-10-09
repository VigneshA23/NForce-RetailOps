package com.nforce.retailops.dto;

// How an Inventory Counts entry was made: a Start of Day or End of Day count,
// or a delivery (an order marked Received).
public enum InventoryCountSource {
    START_OF_DAY,
    END_OF_DAY,
    STOCK_RECEIVED
}
