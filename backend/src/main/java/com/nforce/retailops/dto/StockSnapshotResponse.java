package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.User;

import java.time.OffsetDateTime;

// One Start of Day or End of Day snapshot. usable = available - deadStock.
// edited is true once someone has re-saved it after the first entry.
public record StockSnapshotResponse(
    int available,
    int deadStock,
    int usable,
    Long enteredById,
    String enteredByName,
    OffsetDateTime enteredAt,
    String lastUpdatedByName,
    OffsetDateTime lastUpdatedAt,
    boolean edited
) {
    // Null when the snapshot hasn't been taken yet.
    public static StockSnapshotResponse from(StockCheck check, StockCheckSnapshot snapshot) {
        if (check == null || !check.hasSnapshot(snapshot)) {
            return null;
        }
        boolean start = snapshot == StockCheckSnapshot.START_OF_DAY;
        User enteredBy = start ? check.getStartOfDayEnteredBy() : check.getEndOfDayEnteredBy();
        User checkedBy = start ? check.getStartOfDayCheckedBy() : check.getEndOfDayCheckedBy();
        OffsetDateTime enteredAt = start ? check.getStartOfDayEnteredAt() : check.getEndOfDayEnteredAt();
        OffsetDateTime checkedAt = start ? check.getStartOfDayCheckedAt() : check.getEndOfDayCheckedAt();
        Integer dead = check.deadStockFor(snapshot);
        return new StockSnapshotResponse(
            check.availableFor(snapshot),
            dead == null ? 0 : dead,
            check.usableFor(snapshot),
            enteredBy != null ? enteredBy.getId() : null,
            enteredBy != null ? enteredBy.getFullName() : null,
            enteredAt,
            checkedBy != null ? checkedBy.getFullName() : null,
            checkedAt,
            enteredAt != null && checkedAt != null && !enteredAt.isEqual(checkedAt)
        );
    }
}
