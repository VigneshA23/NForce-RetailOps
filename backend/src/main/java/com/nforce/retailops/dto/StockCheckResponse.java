package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckCorrection;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record StockCheckResponse(
    Long id,
    Long storeInventoryItemId,
    String itemName,
    LocalDate checkDate,
    int currentCount,
    int quantityNeeded,
    String checkedByName,
    OffsetDateTime createdAt,
    boolean corrected,
    Integer originalCurrentCount,
    String correctedByName,
    OffsetDateTime correctedAt
) {
    public static StockCheckResponse from(StockCheck check) {
        return from(check, null, null);
    }

    // earliest/latest are both null when the check has never been
    // corrected. When present, originalCurrentCount comes from the
    // EARLIEST correction (what the employee actually entered) and
    // correctedByName/correctedAt from the LATEST one (who most recently
    // touched it) -- current_count/quantityNeeded on the check itself are
    // already the latest corrected values.
    public static StockCheckResponse from(StockCheck check, StockCheckCorrection earliest, StockCheckCorrection latest) {
        boolean corrected = earliest != null;
        return new StockCheckResponse(
            check.getId(),
            check.getStoreInventoryItem().getId(),
            check.getStoreInventoryItem().getName(),
            check.getCheckDate(),
            check.getCurrentCount(),
            check.getQuantityNeeded(),
            check.getCheckedBy().getFullName(),
            check.getCreatedAt(),
            corrected,
            corrected ? earliest.getOriginalCount() : null,
            corrected ? latest.getCorrectedBy().getFullName() : null,
            corrected ? latest.getCorrectedAt() : null
        );
    }
}
