package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StockCheck;

import java.time.OffsetDateTime;

// Why a day has no End of Day count: nobody could count it. Null on responses
// for days that were counted (or are simply still pending).
public record EndOfDaySkippedResponse(String reason, String byName, OffsetDateTime at) {

    public static EndOfDaySkippedResponse from(StockCheck check) {
        if (check == null || !check.isEndOfDaySkipped()) {
            return null;
        }
        return new EndOfDaySkippedResponse(
            check.getEndOfDaySkippedReason(),
            check.getEndOfDaySkippedBy() != null ? check.getEndOfDaySkippedBy().getFullName() : null,
            check.getEndOfDaySkippedAt());
    }
}
