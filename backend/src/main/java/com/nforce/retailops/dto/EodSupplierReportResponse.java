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
        Status status
    ) {
    }

    public enum Status {
        NEEDS_TO_ORDER,
        SUFFICIENT,
        END_OF_DAY_PENDING,
        NO_MINIMUM_SET
    }
}
