package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

// One past count in an item's history timeline, newest first. delta is null
// for the oldest entry returned (nothing earlier to compare against in this
// window).
public record InventoryCountHistoryEntryResponse(
    LocalDate checkDate,
    BigDecimal count,
    BigDecimal delta,
    String updatedByName,
    OffsetDateTime updatedAt
) {
}
