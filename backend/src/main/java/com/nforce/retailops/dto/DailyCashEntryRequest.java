package com.nforce.retailops.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

// Owner/Admin daily cash entry. businessDate defaults to today when omitted.
// otherAdjustments is signed; every other amount is non-negative.
public record DailyCashEntryRequest(
    LocalDate businessDate,

    @NotNull(message = "Total cash sales is required")
    @DecimalMin(value = "0", message = "Total cash sales cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Total cash sales: use at most 2 decimal places")
    BigDecimal totalCashSales,

    @NotNull(message = "Opening drawer cash is required")
    @DecimalMin(value = "0", message = "Opening drawer cash cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Opening drawer cash: use at most 2 decimal places")
    BigDecimal openingDrawerCash,

    @NotNull(message = "Cash removed is required")
    @DecimalMin(value = "0", message = "Cash removed cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Cash removed: use at most 2 decimal places")
    BigDecimal cashRemoved,

    @NotNull(message = "Cash remaining is required")
    @DecimalMin(value = "0", message = "Cash remaining cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Cash remaining: use at most 2 decimal places")
    BigDecimal cashRemaining,

    @NotNull(message = "Cash expenses is required")
    @DecimalMin(value = "0", message = "Cash expenses cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Cash expenses: use at most 2 decimal places")
    BigDecimal cashExpenses,

    @NotNull(message = "Bank deposits is required")
    @DecimalMin(value = "0", message = "Bank deposits cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Bank deposits: use at most 2 decimal places")
    BigDecimal bankDeposits,

    @NotNull(message = "Other adjustments is required (use 0 if none)")
    @Digits(integer = 10, fraction = 2, message = "Other adjustments: use at most 2 decimal places")
    BigDecimal otherAdjustments
) {
}
