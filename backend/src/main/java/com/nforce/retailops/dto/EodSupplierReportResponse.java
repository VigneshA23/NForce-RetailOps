package com.nforce.retailops.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

// Owner/Admin's End of Day supplier report for one business day: every item,
// grouped by preferred supplier ("No Supplier" last).
public record EodSupplierReportResponse(
    LocalDate date,
    List<Group> groups,
    int itemsNeedingOrder,
    int itemsPendingEndOfDay
) {
    public record Group(Long supplierId, String supplierName, List<Row> items) {
    }

    // Stock figures are null where that snapshot wasn't taken. deadStock is
    // the End of Day figure; stockUsed = start usable - end usable.
    public record Row(
        Long storeInventoryItemId,
        String itemName,
        String unitOfMeasurement,
        String category,
        Long imageId,
        BigDecimal startOfDayAvailable,
        BigDecimal startOfDayDeadStock,
        BigDecimal endOfDayAvailable,
        BigDecimal endOfDayDeadStock,
        BigDecimal stockUsed,
        BigDecimal requiredTomorrow,
        BigDecimal quantityToOrder,
        Status status,
        // The quantity actually placed with the supplier via the Order List
        // page's own ORDERED (not yet RECEIVED) entry for this item, if one
        // exists -- null otherwise. Separate from quantityToOrder, which is
        // this report's own stock-check-derived figure; the two can disagree
        // (e.g. an order already placed for more or less than EOD computes).
        BigDecimal orderedQuantity,
        // The item's NEEDS_ORDERING Order List entry (today's report only), so
        // the Owner/Admin can mark it Ordered straight from this report --
        // null whenever there's nothing to act on.
        Long orderEntryId,
        // The day the order was actually placed -- which can be later than
        // this report's own date (yesterday's shortage ordered today).
        LocalDate orderedOn
    ) {
    }

    // Lifecycle of a row: START_OF_DAY_PENDING (nothing counted) ->
    // END_OF_DAY_PENDING (Start of Day only) -> once End of Day is in, judged
    // against tomorrow's requirement: SUFFICIENT / NO_MINIMUM_SET, or
    // NEEDS_TO_ORDER -> ORDERED (the only transition made from this report,
    // and only for today and yesterday). A shortage nobody ordered by the time
    // its day is more than a day old is NOT_ORDERED, and stays so.
    public enum Status {
        START_OF_DAY_PENDING,
        END_OF_DAY_PENDING,
        NEEDS_TO_ORDER,
        ORDERED,
        NOT_ORDERED,
        SUFFICIENT,
        NO_MINIMUM_SET
    }
}
