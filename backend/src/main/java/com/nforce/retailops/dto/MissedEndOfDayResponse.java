package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.User;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;

// What a MISSED_END_OF_DAY notification shows: every item that was counted at
// Start of Day on that date, and where its End of Day stands now. Worked out
// live, so a row answered by someone else shows as answered.
public record MissedEndOfDayResponse(LocalDate date, List<Item> items) {

    public static final String PENDING = "PENDING";
    public static final String COUNTED = "COUNTED";
    public static final String COULD_NOT_COUNT = "COULD_NOT_COUNT";

    // status PENDING / COUNTED / COULD_NOT_COUNT. answeredBy* and reason are set
    // once it is no longer pending (reason only for COULD_NOT_COUNT).
    public record Item(
        Long storeInventoryItemId,
        String itemName,
        String unitOfMeasurement,
        BigDecimal startOfDayUsable,
        String status,
        BigDecimal endOfDayAvailable,
        BigDecimal endOfDayDeadStock,
        String answeredByName,
        OffsetDateTime answeredAt,
        String reason
    ) {
        public static Item from(StockCheck check) {
            boolean counted = check.hasSnapshot(StockCheckSnapshot.END_OF_DAY);
            boolean skipped = !counted && check.isEndOfDaySkipped();
            User by = counted
                ? (check.getEndOfDayEnteredBy() != null ? check.getEndOfDayEnteredBy() : check.getEndOfDayCheckedBy())
                : check.getEndOfDaySkippedBy();
            OffsetDateTime at = counted
                ? (check.getEndOfDayEnteredAt() != null ? check.getEndOfDayEnteredAt() : check.getEndOfDayCheckedAt())
                : check.getEndOfDaySkippedAt();
            return new Item(
                check.getStoreInventoryItem().getId(),
                check.getStoreInventoryItem().getName(),
                check.getStoreInventoryItem().getUnitOfMeasurement(),
                check.usableFor(StockCheckSnapshot.START_OF_DAY),
                counted ? COUNTED : skipped ? COULD_NOT_COUNT : PENDING,
                check.getEndOfDayAvailable(),
                check.getEndOfDayDeadStock(),
                by != null ? by.getFullName() : null,
                at,
                skipped ? check.getEndOfDaySkippedReason() : null
            );
        }
    }

    // Only rows that had a Start of Day count and whose item is still active.
    public static MissedEndOfDayResponse of(LocalDate date, List<StockCheck> checks) {
        List<Item> items = checks.stream()
            .filter(c -> c.hasSnapshot(StockCheckSnapshot.START_OF_DAY) && c.getStoreInventoryItem().isActive())
            .map(Item::from)
            .sorted(Comparator.comparing(Item::itemName, String.CASE_INSENSITIVE_ORDER))
            .toList();
        return new MissedEndOfDayResponse(date, items);
    }
}
