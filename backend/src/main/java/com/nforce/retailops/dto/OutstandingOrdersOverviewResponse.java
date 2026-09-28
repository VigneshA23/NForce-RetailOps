package com.nforce.retailops.dto;

import java.util.List;

// Super Admin's platform-wide view of what still needs ordering, broken down by
// store. Read-only -- status changes stay on the owner's Order Dashboard.
public record OutstandingOrdersOverviewResponse(
    // Every NEEDS_ORDERING entry platform-wide. Summed across ALL groups before
    // the row cap is applied, so truncating `stores` never moves this number.
    long platformOutstandingCount,
    // How many stores had anything outstanding, before truncation -- lets the UI
    // say "showing 50 of 137" rather than silently presenting a partial list.
    int storesWithOutstanding,
    boolean truncated,
    List<StoreOutstandingOrdersRow> stores
) {
}
