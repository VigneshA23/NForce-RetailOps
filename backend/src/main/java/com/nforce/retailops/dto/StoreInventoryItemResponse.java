package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StoreInventoryItem;

public record StoreInventoryItemResponse(
    Long id,
    Long inventoryItemId,
    String itemName,
    String categoryName,
    String unitOfMeasurement,
    Integer minWeekday,
    Integer minWeekend,
    Long preferredSupplierId,
    String preferredSupplierName,
    boolean active
) {
    public static StoreInventoryItemResponse from(StoreInventoryItem sii) {
        return new StoreInventoryItemResponse(
            sii.getId(),
            sii.getInventoryItem().getId(),
            sii.getInventoryItem().getName(),
            sii.getInventoryItem().getCategory().getName(),
            sii.getInventoryItem().getUnitOfMeasurement(),
            sii.getMinWeekday(),
            sii.getMinWeekend(),
            sii.getPreferredSupplier() != null ? sii.getPreferredSupplier().getId() : null,
            sii.getPreferredSupplier() != null ? sii.getPreferredSupplier().getName() : null,
            sii.isActive()
        );
    }
}
