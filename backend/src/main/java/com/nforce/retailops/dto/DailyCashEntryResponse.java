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
    List<Correction> history
) {
    // One prior version of the entry, oldest first.
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
        OffsetDateTime correctedAt
    ) {
    }
}
