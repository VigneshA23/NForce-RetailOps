package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StoreInventoryItem;

public record StoreInventoryItemResponse(
    Long id,
    Long storeId,
    String storeName,
    String name,
    Long categoryId,
    String categoryName,
    String unitOfMeasurement,
    Integer minWeekday,
    Integer minWeekend,
    Long preferredSupplierId,
    String preferredSupplierName,
    String note,
    boolean active
) {
    public static StoreInventoryItemResponse from(StoreInventoryItem sii) {
        return new StoreInventoryItemResponse(
            sii.getId(),
            sii.getStore().getId(),
            sii.getStore().getName(),
            sii.getName(),
            sii.getCategory().getId(),
            sii.getCategory().getName(),
            sii.getUnitOfMeasurement(),
            sii.getMinWeekday(),
            sii.getMinWeekend(),
            sii.getPreferredSupplier() != null ? sii.getPreferredSupplier().getId() : null,
            sii.getPreferredSupplier() != null ? sii.getPreferredSupplier().getName() : null,
            sii.getNote(),
            sii.isActive()
        );
    }
}
