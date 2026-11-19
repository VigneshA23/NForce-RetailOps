package com.nforce.retailops.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

// Daily cash entry: the five agreed fields, in the order the page shows them.
// businessDate defaults to today when omitted and cannot be in the future
// (server's default timezone, like every other date boundary).
// otherAdjustments is signed and optional (blank counts as 0); every other amount
// is required, 0 or more, 2 decimals max.
public record DailyCashEntryRequest(
    @PastOrPresent(message = "Business date cannot be in the future")
    LocalDate businessDate,

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

    @Digits(integer = 10, fraction = 2, message = "Other adjustments: use at most 2 decimal places")
    BigDecimal otherAdjustments,

    // Required when this changes an entry that already exists (a direct
    // correction); ignored on the first save of a day. Enforced in
    // DailyCashEntryService, which knows whether the entry exists.
    @Size(max = 500, message = "Reason must be 500 characters or fewer")
    String correctionReason
) {
    // Other adjustments is optional; a blank one is recorded as 0.
    public BigDecimal otherAdjustmentsOrZero() {
        return otherAdjustments == null ? BigDecimal.ZERO : otherAdjustments;
    }
}
