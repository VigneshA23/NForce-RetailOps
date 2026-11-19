package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * One column of the month-end cash summary: a single store, or the Combined
 * total ({@code storeId} null).
 *
 * <p>Flow figures (cash removed, cash remaining, adjustments) are the month's
 * totals; cash removed is only recorded, it does not enter expected cash.
 * {@code expectedCashOnHand} is a balance as at {@code asOfDate}, the last day
 * in the month with an entry: the running total of every day's
 * (cash remaining +/- adjustments) from the 1st of the month; earlier months
 * are not carried forward.
 *
 * <p>{@code dailyBreakdown} lists every recorded day, oldest first. Days with
 * no entry are absent, not zero rows; it is empty for a store with no entries
 * and for Combined.
 *
 * <p>When {@code daysRecorded} is 0 every amount is null, never a fake 0.
 */
public record StoreMonthlyCashSummary(
    Long storeId,
    String storeName,
    Long storeCode,
    int daysRecorded,
    LocalDate asOfDate,
    BigDecimal totalCashRemoved,
    BigDecimal totalCashRemaining,
    BigDecimal adjustments,
    BigDecimal expectedCashOnHand,
    List<DailyCashBreakdown> dailyBreakdown
) {
    public StoreMonthlyCashSummary {
        dailyBreakdown = dailyBreakdown == null ? List.of() : List.copyOf(dailyBreakdown);
    }

    public static StoreMonthlyCashSummary empty(Long storeId, String storeName, Long storeCode) {
        return new StoreMonthlyCashSummary(
            storeId, storeName, storeCode, 0, null,
            null, null, null, null,
            List.of()
        );
    }
}
