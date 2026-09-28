package com.nforce.retailops.util;

import com.nforce.retailops.exception.InvalidDateRangeException;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

// Shared date-range guard for any endpoint that accepts a bounded from/to
// range (checklist history, stock-check history, ...). Extracted from
// ChecklistHistoryService.validateRange so every caller enforces the same
// cap the same way instead of drifting apart.
public final class DateRangeValidator {

    private DateRangeValidator() {
    }

    public static void validate(LocalDate startDate, LocalDate endDate, int maxDays) {
        if (startDate == null || endDate == null) {
            throw new InvalidDateRangeException("Both startDate and endDate are required");
        }
        if (startDate.isAfter(endDate)) {
            throw new InvalidDateRangeException("Start date must be on or before end date");
        }
        long spanDays = ChronoUnit.DAYS.between(startDate, endDate) + 1;
        if (spanDays > maxDays) {
            throw new InvalidDateRangeException("Date range cannot exceed " + maxDays + " days");
        }
    }
}
