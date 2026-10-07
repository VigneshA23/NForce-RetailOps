package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StockCheckCorrection;
import com.nforce.retailops.entity.StockCheckSnapshot;

import java.time.OffsetDateTime;

// One edit of an existing snapshot, for Inventory History. previousAvailable
// is null when the snapshot had no prior value at all (an Owner/Admin
// correction filling in one that was never recorded); previousDeadStock is
// null on edits recorded before dead stock was tracked.
public record StockCheckEditResponse(
    StockCheckSnapshot snapshot,
    Integer previousAvailable,
    Integer previousDeadStock,
    int newAvailable,
    Integer newDeadStock,
    String editedByName,
    OffsetDateTime editedAt,
    String reason
) {
    public static StockCheckEditResponse from(StockCheckCorrection correction) {
        return new StockCheckEditResponse(
            correction.getSnapshot(),
            correction.getOriginalCount(),
            correction.getOriginalDeadStock(),
            correction.getCorrectedCount(),
            correction.getCorrectedDeadStock(),
            correction.getCorrectedBy().getFullName(),
            correction.getCorrectedAt(),
            correction.getReason()
        );
    }
}
