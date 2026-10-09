package com.nforce.retailops.dto;

import java.math.BigDecimal;
import com.nforce.retailops.entity.StockCheckCorrection;
import com.nforce.retailops.entity.StockCheckSnapshot;

import java.time.OffsetDateTime;

// One edit of an existing snapshot, for Inventory History. previousAvailable
// is null when the snapshot had no prior value at all (a correction filling
// in one that was never recorded); previousDeadStock is null on edits
// recorded before dead stock was tracked. editedByRole distinguishes a Super
// Admin's cross-store correction (RTS-306) from a store-side one -- it does
// not further distinguish Employee from Owner/Admin, since nothing consuming
// this needs that finer split.
public record StockCheckEditResponse(
    StockCheckSnapshot snapshot,
    BigDecimal previousAvailable,
    BigDecimal previousDeadStock,
    BigDecimal newAvailable,
    BigDecimal newDeadStock,
    String editedByName,
    String editedByRole,
    OffsetDateTime editedAt,
    String reason
) {
    public static StockCheckEditResponse from(StockCheckCorrection correction) {
        boolean bySuperAdmin = correction.getCorrectedBySuperAdmin() != null;
        String editedByName = bySuperAdmin
            ? correction.getCorrectedBySuperAdmin().getName()
            : correction.getCorrectedByUser().getFullName();
        return new StockCheckEditResponse(
            correction.getSnapshot(),
            correction.getOriginalCount(),
            correction.getOriginalDeadStock(),
            correction.getCorrectedCount(),
            correction.getCorrectedDeadStock(),
            editedByName,
            bySuperAdmin ? "SUPER_ADMIN" : "STORE_USER",
            correction.getCorrectedAt(),
            correction.getReason()
        );
    }
}
