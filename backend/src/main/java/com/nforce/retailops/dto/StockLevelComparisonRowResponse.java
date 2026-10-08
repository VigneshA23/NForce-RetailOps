package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

// One store's row on Super Admin's cross-store stock-level comparison for a
// single item (matched by name -- there is no shared item catalog). When
// assigned is false, the store has no inventory item of that name at all:
// requiredToday, currentAvailable, asOfDate and status are all null, never 0
// or blank, so "not assigned" can't be mistaken for "assigned with zero
// stock".
public record StockLevelComparisonRowResponse(
    Long storeId,
    String storeName,
    boolean assigned,
    BigDecimal requiredToday,
    BigDecimal currentAvailable,
    LocalDate asOfDate,
    InventoryCountStatus status
) {
}
