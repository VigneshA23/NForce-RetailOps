package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * Expected cash on hand for one store, derived from that store's most recent
 * daily cash entry.
 *
 * <p>When {@code available} is false (the store has no cash entries yet) every
 * other field except {@code storeId} and {@code message} is null, so a client
 * can never mistake "no data" for a genuine zero.
 *
 * <p>{@code lastUpdatedAt} is when that entry was last saved (first save or
 * any later correction), so a client can show when the count was entered.
 *
 * <p>{@code variance} = cashRemaining (physically counted) - expectedCashOnHand:
 * positive is an overage, negative is a shortage.
 */
public record ExpectedCashResponse(
    Long storeId,
    boolean available,
    String message,
    LocalDate asOfDate,
    OffsetDateTime lastUpdatedAt,
    BigDecimal expectedCashOnHand,
    BigDecimal cashRemaining,
    BigDecimal variance,
    BigDecimal openingDrawerCash,
    BigDecimal totalCashSales,
    BigDecimal cashRemoved,
    BigDecimal bankDeposits,
    BigDecimal cashExpenses,
    BigDecimal otherAdjustments
) {
    public static ExpectedCashResponse unavailable(Long storeId) {
        return new ExpectedCashResponse(
            storeId, false, "No cash entries have been recorded for this store yet",
            null, null, null, null, null, null, null, null, null, null, null
        );
    }
}
