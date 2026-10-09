package com.nforce.retailops.util;

import com.nforce.retailops.dto.InventoryCountStatus;
import com.nforce.retailops.entity.StockCheck;

import java.math.BigDecimal;
import java.time.LocalDate;

// Shared status tiering for every view that shows a live stock-check status
// (Owner/Admin's Inventory Counts, Super Admin's cross-store comparison).
// Freshness always wins: an item with no check today is STALE even if its
// last known count was already zero or below minimum -- it needs a recount
// before out-of-stock/low can be trusted. A null minimum never produces LOW.
public final class InventoryCountStatusCalculator {

    private InventoryCountStatusCalculator() {
    }

    public static InventoryCountStatus calculate(StockCheck latest, LocalDate today, BigDecimal minimum) {
        if (latest == null || !latest.getCheckDate().isEqual(today)) {
            return InventoryCountStatus.STALE;
        }
        BigDecimal currentStock = latest.getCurrentCount();
        if (currentStock.signum() <= 0) {
            return InventoryCountStatus.OUT_OF_STOCK;
        }
        if (minimum != null && currentStock.compareTo(minimum) < 0) {
            return InventoryCountStatus.LOW;
        }
        return InventoryCountStatus.HEALTHY;
    }
}
