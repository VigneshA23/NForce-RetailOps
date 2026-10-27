package com.nforce.retailops.dto;

// Counts over every record in the requested date range (not just the page
// returned), so the history filter chips agree with the total.
public record StockCheckStatusCounts(
    long all,
    long shortage,
    long sufficient,
    long notCounted
) {
}
