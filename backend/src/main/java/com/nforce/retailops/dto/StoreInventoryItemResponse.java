package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StoreInventoryItem;

import java.time.LocalDate;

public record StoreInventoryItemResponse(
    Long id,
    Long storeId,
    String storeName,
    Long categoryId,
    String categoryName,
    String name,
    String unitOfMeasurement,
    Integer minWeekday,
    Integer minWeekend,
    Long preferredSupplierId,
    String preferredSupplierName,
    String note,
    boolean active,
    boolean autoPoEnabled,
    // Today's minimum (weekday or weekend, per requiredMinimumOn).
    Integer requiredToday,
    // The count from today's employee stock check; null until one is submitted.
    Integer currentAvailable
) {
    public static StoreInventoryItemResponse from(StoreInventoryItem sii, LocalDate today, Integer currentAvailable) {
        return new StoreInventoryItemResponse(
            sii.getId(),
            sii.getStore().getId(),
            sii.getStore().getName(),
            sii.getCategory() != null ? sii.getCategory().getId() : null,
            sii.getCategory() != null ? sii.getCategory().getName() : null,
            sii.getName(),
            sii.getUnitOfMeasurement(),
            sii.getMinWeekday(),
            sii.getMinWeekend(),
            sii.getPreferredSupplier() != null ? sii.getPreferredSupplier().getId() : null,
            sii.getPreferredSupplier() != null ? sii.getPreferredSupplier().getName() : null,
            sii.getNote(),
            sii.isActive(),
            sii.isAutoPoEnabled(),
            sii.requiredMinimumOn(today),
            currentAvailable
        );
    }
}
