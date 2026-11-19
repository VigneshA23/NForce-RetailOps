package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

// Append-only history of every cash entry in a store and date range, newest
// event first. Built at read time from the entries, their corrections and
// their flag history, so nothing here can be edited or deleted. Entries from
// before the history existed show only what is on record: no events are
// invented for them.
public record CashHistoryResponse(
    Long storeId,
    LocalDate from,
    LocalDate to,
    List<Event> events
) {

    // CREATED, EMPLOYEE_EDIT, ADMIN_CORRECTION, FLAGGED, FLAG_EDITED,
    // FLAG_RESOLVED, FLAG_REMOVED.
    public record Event(
        Long entryId,
        LocalDate businessDate,
        String type,
        // Null name = "Unknown" (an entry from before the creator was recorded).
        String actorName,
        // EMPLOYEE, OWNER_ADMIN or SUPER_ADMIN; null when unknown.
        String actorRole,
        OffsetDateTime at,
        // Null for CREATED and for events that do not change figures.
        Figures previous,
        // Null for events that do not change figures.
        Figures current,
        // The flag comment, the correction reason or the employee's note.
        String comment
    ) {
    }

    public record Figures(
        BigDecimal openingDrawerCash,
        BigDecimal cashRemoved,
        BigDecimal cashRemaining,
        BigDecimal otherAdjustments
    ) {
    }
}
