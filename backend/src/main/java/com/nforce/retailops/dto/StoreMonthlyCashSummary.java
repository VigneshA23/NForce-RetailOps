package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * One column of the month-end cash summary: a single store, or the Combined
 * total ({@code storeId} null).
 *
 * <p>Flow figures (sales, removed, deposits, expenses, adjustments) are the
 * month's totals. The position figures (expected, actual, variance) are as at
 * {@code asOfDate}, the last day in the month with an entry -- cash on hand is
 * a balance, so summing it across days would be meaningless.
 * {@code netDailyVariance} adds up every day's over/short, so a shortage
 * mid-month that was later made good still shows.
 *
 * <p>{@code dailyBreakdown} lists every recorded day, oldest first, as
 * produced by the shared expected-cash calculation: the flow totals are the
 * column sums of these rows, {@code netDailyVariance} the sum of their variance,
 * and the position figures equal the last row. Days with no entry are absent,
 * not zero rows; it is empty for a store with no entries and for Combined.
 *
 * <p>When {@code daysRecorded} is 0 every amount is null, never a fake 0.
 */
public record StoreMonthlyCashSummary(
    Long storeId,
    String storeName,
    Long storeCode,
    int daysRecorded,
    LocalDate asOfDate,
    BigDecimal totalCashSales,
    BigDecimal totalCashRemoved,
    BigDecimal bankDeposits,
    BigDecimal cashExpenses,
    BigDecimal adjustments,
    BigDecimal expectedCashOnHand,
    BigDecimal actualCashCount,
    BigDecimal variance,
    BigDecimal netDailyVariance,
    List<DailyCashBreakdown> dailyBreakdown
) {
    public StoreMonthlyCashSummary {
        dailyBreakdown = dailyBreakdown == null ? List.of() : List.copyOf(dailyBreakdown);
    }

    public static StoreMonthlyCashSummary empty(Long storeId, String storeName, Long storeCode) {
        return new StoreMonthlyCashSummary(
            storeId, storeName, storeCode, 0, null,
            null, null, null, null, null, null, null, null, null,
            List.of()
        );
    }
}
