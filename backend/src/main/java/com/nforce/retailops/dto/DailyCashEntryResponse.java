package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

// Each actor is a user/super-admin id pair; exactly one is non-null.
//
// dailyExpectedCash and expectedCashOnHand are on Owner/Admin and Super Admin
// responses only (Story 5); the employee variant of this payload goes through
// a separate endpoint that strips them.
public record DailyCashEntryResponse(
    Long id,
    Long storeId,
    LocalDate businessDate,
    BigDecimal totalCashSales,
    BigDecimal openingDrawerCash,
    BigDecimal cashRemoved,
    BigDecimal cashRemaining,
    BigDecimal cashExpenses,
    BigDecimal bankDeposits,
    BigDecimal otherAdjustments,
    // Cash remaining + other adjustments for this entry's day, as saved on
    // the row.
    BigDecimal dailyExpectedCash,
    // Running sum of dailyExpectedCash from the store's first entry up to
    // and including this entry's businessDate. Days with no entry add 0.
    BigDecimal expectedCashOnHand,
    Long enteredByUserId,
    Long enteredBySuperAdminId,
    OffsetDateTime enteredAt,
    Long updatedByUserId,
    Long updatedBySuperAdminId,
    OffsetDateTime updatedAt,
    List<Correction> history,
    // The latest direct correction, for the "Corrected by [name]" line; null
    // while the entry has never been corrected.
    String correctedByName,
    OffsetDateTime correctedAt
) {
    // One correction of the entry, oldest first: the old values, and (from
    // V118 on) the new values and the reason.
    public record Correction(
        Long id,
        BigDecimal previousTotalCashSales,
        BigDecimal previousOpeningDrawerCash,
        BigDecimal previousCashRemoved,
        BigDecimal previousCashRemaining,
        BigDecimal previousCashExpenses,
        BigDecimal previousBankDeposits,
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
        BigDecimal newTotalCashSales,
        BigDecimal newOpeningDrawerCash,
        BigDecimal newCashRemoved,
        BigDecimal newCashRemaining,
        BigDecimal newCashExpenses,
        BigDecimal newBankDeposits,
        BigDecimal newOtherAdjustments
    ) {
    }
}
