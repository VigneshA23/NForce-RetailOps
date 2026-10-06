package com.nforce.retailops.dto;

import com.nforce.retailops.entity.InventoryItemCategory;
import com.nforce.retailops.entity.StoreInventoryItem;

import java.time.LocalDate;

public record StoreInventoryItemResponse(
    Long id,
    Long storeId,
    String storeName,
    String name,
    // Null for items created before category support (V77) that haven't
    // been edited since.
    InventoryItemCategory category,
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
    Integer currentAvailable,
    // Stored display image, served by GET /api/inventory-images/{imageId};
    // null when none has been picked.
    Long imageId
) {
    public static StoreInventoryItemResponse from(StoreInventoryItem sii, LocalDate today, Integer currentAvailable) {
        return new StoreInventoryItemResponse(
            sii.getId(),
            sii.getStore().getId(),
            sii.getStore().getName(),
            sii.getName(),
            sii.getCategory(),
            sii.getUnitOfMeasurement(),
            sii.getMinWeekday(),
            sii.getMinWeekend(),
            sii.getPreferredSupplier() != null ? sii.getPreferredSupplier().getId() : null,
            sii.getPreferredSupplier() != null ? sii.getPreferredSupplier().getName() : null,
            sii.getNote(),
            sii.isActive(),
            sii.isAutoPoEnabled(),
            sii.requiredMinimumOn(today),
            currentAvailable,
            sii.getImageId()
        );
    }
}
