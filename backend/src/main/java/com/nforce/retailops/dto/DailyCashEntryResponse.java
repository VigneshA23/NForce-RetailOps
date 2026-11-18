package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

// Each actor is a user/super-admin id pair plus a display name. enteredBy* are
// all null for entries from before the creator was recorded (shown as
// "Unknown"); updatedBy*/correctedBy* always name someone.
public record DailyCashEntryResponse(
    Long id,
    Long storeId,
    LocalDate businessDate,
    BigDecimal openingDrawerCash,
    BigDecimal cashExpenses,
    BigDecimal cashRemoved,
    BigDecimal cashRemaining,
    BigDecimal otherAdjustments,
    Long enteredByUserId,
    Long enteredBySuperAdminId,
    String enteredByName,
    OffsetDateTime enteredAt,
    Long updatedByUserId,
    Long updatedBySuperAdminId,
    String updatedByName,
    OffsetDateTime updatedAt,
    List<Correction> history,
    // The latest direct correction, for the "Corrected by [name]" line; null
    // while the entry has never been corrected.
    String correctedByName,
    OffsetDateTime correctedAt
) {
    // One correction of the entry, oldest first: the old values, and (from
    // V118 on) the new values and the reason. correctedBy* is who made the
    // edit that replaced the old values. reason is null for an employee's own
    // edit of today's entry (no reason is asked of them).
    public record Correction(
        Long id,
        BigDecimal previousOpeningDrawerCash,
        BigDecimal previousCashExpenses,
        BigDecimal previousCashRemoved,
        BigDecimal previousCashRemaining,
        BigDecimal previousOtherAdjustments,
        Long previousUpdatedByUserId,
        Long previousUpdatedBySuperAdminId,
        OffsetDateTime previousUpdatedAt,
        Long correctedByUserId,
        Long correctedBySuperAdminId,
        OffsetDateTime correctedAt,
        String correctedByName,
        String reason,
        BigDecimal newOpeningDrawerCash,
        BigDecimal newCashExpenses,
        BigDecimal newCashRemoved,
        BigDecimal newCashRemaining,
        BigDecimal newOtherAdjustments
    ) {
    }
}
