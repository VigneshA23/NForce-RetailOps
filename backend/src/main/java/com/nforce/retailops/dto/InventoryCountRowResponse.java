package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StockCheckSnapshot;

import java.time.LocalDate;
import java.time.OffsetDateTime;

// One item's live state on the Inventory Counts view. currentStock/
// lastUpdatedAt/lastUpdatedByName are null for an item that has never been
// counted -- it still shows (status STALE) rather than being hidden.
//
// latestCheckId + latestSnapshot identify exactly which StockCheck row and
// snapshot "Edit count" should correct (reusing the existing
// PATCH /api/stores/inventory/stock-checks/{id} endpoint) -- both null when
// there's nothing to edit yet.
public record InventoryCountRowResponse(
    Long itemId,
    String name,
    String category,
    String unitOfMeasurement,
    Integer currentStock,
    Integer minimum,
    InventoryCountStatus status,
    OffsetDateTime lastUpdatedAt,
    String lastUpdatedByName,
    // Change vs. the previous count on record; null when there's no earlier
    // count to compare against.
    Integer change,
    LocalDate changeFromDate,
    Long latestCheckId,
    StockCheckSnapshot latestSnapshot,
    Integer latestAvailable,
    Integer latestDeadStock,
    Long imageId
) {
}
