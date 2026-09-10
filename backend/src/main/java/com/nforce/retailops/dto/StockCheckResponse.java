package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StockCheck;

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
    OffsetDateTime createdAt
) {
    public static StockCheckResponse from(StockCheck check) {
        return new StockCheckResponse(
            check.getId(),
            check.getStoreInventoryItem().getId(),
            check.getStoreInventoryItem().getInventoryItem().getName(),
            check.getCheckDate(),
            check.getCurrentCount(),
            check.getQuantityNeeded(),
            check.getCheckedBy().getFullName(),
            check.getCreatedAt()
        );
    }
}
