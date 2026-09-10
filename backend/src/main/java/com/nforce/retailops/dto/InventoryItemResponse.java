package com.nforce.retailops.dto;

import com.nforce.retailops.entity.InventoryItem;

public record InventoryItemResponse(
    Long id,
    Long categoryId,
    String categoryName,
    String name,
    String unitOfMeasurement,
    boolean active
) {
    public static InventoryItemResponse from(InventoryItem item) {
        return new InventoryItemResponse(
            item.getId(),
            item.getCategory().getId(),
            item.getCategory().getName(),
            item.getName(),
            item.getUnitOfMeasurement(),
            item.isActive()
        );
    }
}
