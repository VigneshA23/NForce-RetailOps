package com.nforce.retailops.util;

import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.exception.InvalidStockCheckException;

import java.math.BigDecimal;
import java.math.RoundingMode;

// How a history row is classified for the Shortage / Sufficient / Not Counted
// filter. Mirrors frontend/src/utils/stockCheckHistoryStatus.ts: the day's End
// of Day usable count is compared with that day's own par
// (requiredMinimumOn(checkDate)), so a row can't land in a different bucket
// depending on which side did the classifying.
public enum StockCheckHistoryStatus {
    SHORTAGE,
    SUFFICIENT,
    // No End of Day count to compare with the par (or no par to compare to).
    NOT_COUNTED,
    // End of Day explained as not countable. Shows under "All" only.
    SKIPPED;

    public static StockCheckHistoryStatus classify(StockCheck check) {
        BigDecimal counted = check.usableFor(StockCheckSnapshot.END_OF_DAY);
        BigDecimal par = check.getStoreInventoryItem().requiredMinimumOn(check.getCheckDate());
        if (counted != null && par != null) {
            // Rounded to 2dp like the frontend's deficit, so sub-cent noise
            // can't flip a row into Shortage.
            return par.subtract(counted).setScale(2, RoundingMode.HALF_UP).signum() > 0 ? SHORTAGE : SUFFICIENT;
        }
        return counted == null && check.isEndOfDaySkipped() ? SKIPPED : NOT_COUNTED;
    }

    // Query-string value: shortage | sufficient | not_counted. Null/blank means
    // no filter.
    public static StockCheckHistoryStatus parseFilter(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return switch (value.trim().toLowerCase()) {
            case "shortage" -> SHORTAGE;
            case "sufficient" -> SUFFICIENT;
            case "not_counted" -> NOT_COUNTED;
            default -> throw new InvalidStockCheckException("Unknown status filter: " + value);
        };
    }
}
