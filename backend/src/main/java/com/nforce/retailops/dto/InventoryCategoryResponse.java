package com.nforce.retailops.dto;

import com.nforce.retailops.entity.InventoryCategory;

public record InventoryCategoryResponse(
    Long id,
    String name,
    int displayOrder,
    boolean active,
    int itemCount
) {
    public static InventoryCategoryResponse from(InventoryCategory category, int itemCount) {
        return new InventoryCategoryResponse(
            category.getId(),
            category.getName(),
            category.getDisplayOrder(),
            category.isActive(),
            itemCount
        );
    }
}
