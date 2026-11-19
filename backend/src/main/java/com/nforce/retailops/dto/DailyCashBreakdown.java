package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One recorded business date inside a month-end cash summary.
 *
 * <p>{@code openingDrawerCash} and {@code cashRemoved} are recorded figures
 * only. {@code cashRemaining} is what was dropped into the safe;
 * {@code dailyExpected} = cashRemaining + adjustments, and
 * {@code expectedCashOnHand} is the running total of {@code dailyExpected} from
 * the 1st of the month up to this day (earlier months are not carried in). Any recorded figure is null when
 * nobody entered it.
 */
public record DailyCashBreakdown(
    LocalDate businessDate,
    BigDecimal openingDrawerCash,
    BigDecimal cashRemoved,
    BigDecimal cashRemaining,
    BigDecimal adjustments,
    BigDecimal dailyExpected,
    BigDecimal expectedCashOnHand
) {
}
