package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

// One entry in an item's history timeline, newest first: a Start of Day or End
// of Day count, or a delivery (see source). count is the usable stock after the
// entry. delta is null for the oldest entry returned (nothing earlier to
// compare against in this window).
public record InventoryCountHistoryEntryResponse(
    LocalDate checkDate,
    BigDecimal count,
    BigDecimal delta,
    String updatedByName,
    OffsetDateTime updatedAt,
    InventoryCountSource source
) {
}
