package com.nforce.retailops.entity;

// RESTOCK: stock the employee says arrived. LOWER_COUNT: a Start of Day lower
// than yesterday's End of Day, which the Owner/Admin has to accept.
public enum StockReceiptRequestType {
    RESTOCK,
    LOWER_COUNT
}
