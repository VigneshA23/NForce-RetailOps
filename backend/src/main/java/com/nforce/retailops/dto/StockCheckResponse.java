package com.nforce.retailops.dto;

import java.math.BigDecimal;
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
    // Null for items created before category support (V77) that haven't
    // been edited since.
    String category,
    String unitOfMeasurement,
    LocalDate checkDate,
    // This day's own par level (item.requiredMinimumOn(checkDate)) -- unlike
    // requiredTomorrow below, this is set whether or not End of Day was ever
    // recorded, so history views can show a par target for every row.
    BigDecimal requiredPar,
    StockSnapshotResponse startOfDay,
    StockSnapshotResponse endOfDay,
    // Delivered today; already excluded from stockUsed.
    BigDecimal quantityReceived,
    BigDecimal stockUsed,
    BigDecimal requiredTomorrow,
    // Null until End of Day has been counted.
    BigDecimal quantityToOrder,
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
            check.getStoreInventoryItem().getCategory(),
            check.getStoreInventoryItem().getUnitOfMeasurement(),
            check.getCheckDate(),
            check.getStoreInventoryItem().requiredMinimumOn(check.getCheckDate()),
            StockSnapshotResponse.from(check, StockCheckSnapshot.START_OF_DAY),
            StockSnapshotResponse.from(check, StockCheckSnapshot.END_OF_DAY),
            check.getQuantityReceived(),
            check.stockUsed(),
            check.getRequiredTomorrow(),
            check.hasSnapshot(StockCheckSnapshot.END_OF_DAY) ? check.getQuantityNeeded() : null,
            edits
        );
    }
}
