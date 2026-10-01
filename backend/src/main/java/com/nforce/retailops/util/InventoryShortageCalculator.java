package com.nforce.retailops.util;

// Shared shortage-quantity formula for every count-driven flow (the daily
// stock check submission and its Owner/Admin correction). quantityNeeded is
// always max(configuredMinimum - physicalCount, 0) -- floored at zero rather
// than going negative when the count already meets or exceeds the minimum.
// A null minimum (nothing configured for the item) means nothing is owed.
public final class InventoryShortageCalculator {

    private InventoryShortageCalculator() {
    }

    public static int calculateQuantityNeeded(Integer configuredMinimum, int physicalCount) {
        if (configuredMinimum == null) {
            return 0;
        }
        return Math.max(0, configuredMinimum - physicalCount);
    }
}
