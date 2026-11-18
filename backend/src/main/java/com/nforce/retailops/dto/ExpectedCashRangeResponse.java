package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

// Sum of daily expected cash across every entry for the store with a
// businessDate inside [from, to] inclusive. Days with no entry add 0, so the
// sum is 0 when the range has none.
public record ExpectedCashRangeResponse(
    Long storeId,
    LocalDate from,
    LocalDate to,
    BigDecimal expectedCashOnHand
) {
}
