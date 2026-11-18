package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

// Each actor is a user/super-admin id pair; exactly one is non-null.
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
