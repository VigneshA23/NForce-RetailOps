package com.nforce.retailops.dto;

import com.nforce.retailops.entity.InventoryCategory;

public record InventoryCategoryResponse(
    Long id,
    String name,
    boolean active
) {
    public static InventoryCategoryResponse from(InventoryCategory category) {
        return new InventoryCategoryResponse(category.getId(), category.getName(), category.isActive());
    }
}
