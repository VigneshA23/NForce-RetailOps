package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckSnapshot;

import java.time.LocalDate;
import java.util.List;

// One item's stock record for one business day, both snapshots plus the
// derived usage / order figures and every edit made to it (oldest first).
public record StockCheckResponse(
    Long id,
    Long storeInventoryItemId,
    String itemName,
    String unitOfMeasurement,
    LocalDate checkDate,
    // This day's own par level (item.requiredMinimumOn(checkDate)) -- unlike
    // requiredTomorrow below, this is set whether or not End of Day was ever
    // recorded, so history views can show a par target for every row.
    Integer requiredPar,
    StockSnapshotResponse startOfDay,
    StockSnapshotResponse endOfDay,
    Integer stockUsed,
    Integer requiredTomorrow,
    // Null until End of Day has been counted.
    Integer quantityToOrder,
    List<StockCheckEditResponse> edits
) {
    public static StockCheckResponse from(StockCheck check) {
        return from(check, List.of());
    }

    public static StockCheckResponse from(StockCheck check, List<StockCheckEditResponse> edits) {
        return new StockCheckResponse(
            check.getId(),
            check.getStoreInventoryItem().getId(),
            check.getStoreInventoryItem().getName(),
            check.getStoreInventoryItem().getUnitOfMeasurement(),
            check.getCheckDate(),
            check.getStoreInventoryItem().requiredMinimumOn(check.getCheckDate()),
            StockSnapshotResponse.from(check, StockCheckSnapshot.START_OF_DAY),
            StockSnapshotResponse.from(check, StockCheckSnapshot.END_OF_DAY),
            check.stockUsed(),
            check.getRequiredTomorrow(),
            check.hasSnapshot(StockCheckSnapshot.END_OF_DAY) ? check.getQuantityNeeded() : null,
            edits
        );
    }
}
