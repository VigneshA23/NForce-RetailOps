package com.nforce.retailops.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

// Daily cash entry. businessDate defaults to today when omitted and cannot be
// in the future (server's default timezone, like every other date boundary).
//
// Every amount is optional: a null amount means "not given", so it is left as
// it was on a saved day (or unrecorded on a new one). That is what lets the
// employee page save the opening drawer cash on its own, separately from the
// cash removed / cash remaining / other adjustments form, and lets Owner/Admin
// and Super Admin change just the figure they care about. At least one amount
// must be present (enforced in DailyCashEntryService). Amounts are 0 or more
// with 2 decimals, except otherAdjustments, which is signed.
public record DailyCashEntryRequest(
    @PastOrPresent(message = "Business date cannot be in the future")
    LocalDate businessDate,

    @DecimalMin(value = "0", message = "Opening drawer cash cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Opening drawer cash: use at most 2 decimal places")
    BigDecimal openingDrawerCash,

    // Recorded only: not part of expected cash.
    @DecimalMin(value = "0", message = "Cash removed cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Cash removed: use at most 2 decimal places")
    BigDecimal cashRemoved,

    // Cash dropped into the safe after the removed cash.
    @DecimalMin(value = "0", message = "Cash remaining cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Cash remaining: use at most 2 decimal places")
    BigDecimal cashRemaining,

    @Digits(integer = 10, fraction = 2, message = "Other adjustments: use at most 2 decimal places")
    BigDecimal otherAdjustments,

    // Required when this overwrites a figure already recorded on an entry (a
    // direct correction); ignored otherwise. Enforced in DailyCashEntryService,
    // which knows whether the entry exists.
    @Size(max = 500, message = "Reason must be 500 characters or fewer")
    String correctionReason
) {
    public boolean hasAnyAmount() {
        return openingDrawerCash != null || cashRemoved != null
            || cashRemaining != null || otherAdjustments != null;
    }
}
