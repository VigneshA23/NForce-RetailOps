package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One recorded business date inside a month-end cash summary: the figures the
 * Expected Cash on Hand calculation (RTS-295) produced for that day, exposed
 * unchanged so the month totals can be reconciled to the closing figures.
 *
 * <p>{@code cashRemaining} is the physically counted cash (the "actual cash
 * count"); {@code variance} = cashRemaining - expectedCash.
 */
public record DailyCashBreakdown(
    LocalDate businessDate,
    BigDecimal openingDrawerCash,
    BigDecimal totalCashSales,
    BigDecimal cashRemoved,
    BigDecimal bankDeposits,
    BigDecimal cashExpenses,
    BigDecimal adjustments,
    BigDecimal expectedCash,
    BigDecimal cashRemaining,
    BigDecimal variance
) {
    /** Pure field mapping from the shared calculation -- no arithmetic here. */
    public static DailyCashBreakdown from(ExpectedCashResponse day) {
        return new DailyCashBreakdown(
            day.asOfDate(),
            day.openingDrawerCash(),
            day.totalCashSales(),
            day.cashRemoved(),
            day.bankDeposits(),
            day.cashExpenses(),
            day.otherAdjustments(),
            day.expectedCashOnHand(),
            day.cashRemaining(),
            day.variance()
        );
    }
}
