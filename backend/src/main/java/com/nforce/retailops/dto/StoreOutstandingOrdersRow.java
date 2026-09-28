package com.nforce.retailops.dto;

import java.time.OffsetDateTime;

// One store's row in the Super Admin outstanding-orders table. Built from an
// Object[] tuple in SuperAdminOperationsService rather than from an entity, so
// there is no from() factory here -- same as StoreOperationsSummaryResponse.
public record StoreOutstandingOrdersRow(
    Long storeId,
    Long storeCode,
    String storeName,
    // Never null: a store with no active owner link renders as "Unassigned",
    // matching how SuperAdminEmployeeResponse labels an unowned employee.
    String ownerName,
    long outstandingCount,
    // The oldest NEEDS_ORDERING entry's createdAt -- how long the longest-waiting
    // shortage at this store has gone unordered. Never null: a group only exists
    // when it has at least one entry, and OrderListEntry.createdAt is NOT NULL.
    OffsetDateTime oldestOutstandingAt
) {
}
