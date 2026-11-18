package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

// Expected cash on hand as of a date: the sum of every day's expected cash
// from the store's first entry up to and including `asOf`. Days with no entry
// add 0, so a date with no entry of its own still has a figure.
public record ExpectedCashAsOfResponse(Long storeId, LocalDate asOf, BigDecimal expectedCashOnHand) {
}
