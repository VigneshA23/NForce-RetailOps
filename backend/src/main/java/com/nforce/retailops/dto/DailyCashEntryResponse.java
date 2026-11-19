package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

// Each actor is a user/super-admin id pair plus a display name. enteredBy* are
// all null for entries from before the creator was recorded (shown as
// "Unknown"); updatedBy*/correctedBy* always name someone.
//
// dailyExpectedCash and expectedCashOnHand are on Owner/Admin and Super Admin
// responses only (Story 5); the employee variant of this payload goes through
// a separate endpoint that strips them.
public record DailyCashEntryResponse(
    Long id,
    Long storeId,
    LocalDate businessDate,
    BigDecimal openingDrawerCash,
    BigDecimal cashRemoved,
    BigDecimal cashRemaining,
    BigDecimal otherAdjustments,
    // Cash remaining + other adjustments for this entry's day, as saved on
    // the row.
    BigDecimal dailyExpectedCash,
    // Running sum of dailyExpectedCash from the store's first entry up to
    // and including this entry's businessDate. Days with no entry add 0.
    BigDecimal expectedCashOnHand,
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
    OffsetDateTime correctedAt,
    // OWNER_ADMIN, SUPER_ADMIN or EMPLOYEE: who made the latest correction,
    // so the page can say "Corrected by employee [name]".
    String correctedByRole,
    // Entered, Corrected or Flagged. Flagged wins while a flag is open.
    String status,
    // The open flag, or null.
    Flag flag,
    // The most recent flag once it has been closed, or null; shows
    // "Resolved" after the employee fixes the entry.
    Flag resolvedFlag,
    // Employee view only (null elsewhere): may this employee edit the entry
    // right now? Today's unflagged entry, or a flagged entry they entered.
    Boolean canEdit
) {
    // The employee view: the same entry without any expected-cash figure
    // (those are for Owner/Admin and Super Admin only).
    public DailyCashEntryResponse forEmployee() {
        return new DailyCashEntryResponse(
            id, storeId, businessDate, openingDrawerCash, cashRemoved, cashRemaining,
            otherAdjustments, null, null, enteredByUserId, enteredBySuperAdminId, enteredByName, enteredAt,
            updatedByUserId, updatedBySuperAdminId, updatedByName, updatedAt, history, correctedByName, correctedAt,
            correctedByRole, status, flag, resolvedFlag, canEdit);
    }

    public DailyCashEntryResponse withCanEdit(boolean editable) {
        return new DailyCashEntryResponse(
            id, storeId, businessDate, openingDrawerCash, cashRemoved, cashRemaining,
            otherAdjustments, dailyExpectedCash, expectedCashOnHand, enteredByUserId, enteredBySuperAdminId,
            enteredByName, enteredAt, updatedByUserId, updatedBySuperAdminId, updatedByName, updatedAt, history,
            correctedByName, correctedAt, correctedByRole, status, flag, resolvedFlag, editable);
    }

    // A flag as the page shows it. The resolved* fields are null while open.
    public record Flag(
        Long id,
        String comment,
        String flaggedByName,
        String flaggedByRole,
        OffsetDateTime flaggedAt,
        OffsetDateTime commentUpdatedAt,
        String resolvedByName,
        OffsetDateTime resolvedAt,
        // REMOVED, CORRECTED or EMPLOYEE_FIXED; null while open.
        String resolution,
        // The employee's optional note when they fixed it.
        String resolutionNote
    ) {
    }

    // One correction of the entry, oldest first: the old values, and (from
    // V118 on) the new values and the reason. correctedBy* is who made the
    // edit that replaced the old values. reason is null for an employee's own
    // edit of today's entry (no reason is asked of them).
    public record Correction(
        Long id,
        BigDecimal previousOpeningDrawerCash,
        BigDecimal previousCashRemoved,
        BigDecimal previousCashRemaining,
        BigDecimal previousOtherAdjustments,
        // Null on corrections written before V117.
        BigDecimal previousDailyExpectedCash,
        Long previousUpdatedByUserId,
        Long previousUpdatedBySuperAdminId,
        OffsetDateTime previousUpdatedAt,
        Long correctedByUserId,
        Long correctedBySuperAdminId,
        OffsetDateTime correctedAt,
        String correctedByName,
        String reason,
        BigDecimal newOpeningDrawerCash,
        BigDecimal newCashRemoved,
        BigDecimal newCashRemaining,
        BigDecimal newOtherAdjustments
    ) {
    }
}
