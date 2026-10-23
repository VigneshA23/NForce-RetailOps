package com.nforce.retailops.dto;

import com.nforce.retailops.entity.InventoryCategory;

import java.util.Comparator;
import java.util.List;

public record InventoryCategoryResponse(
    Long id,
    String name,
    boolean active,
    boolean appliesToAllStores,
    List<StoreOptionResponse> stores
) {
    public static InventoryCategoryResponse from(InventoryCategory category) {
        List<StoreOptionResponse> sortedStores = category.getStores().stream()
            .map(StoreOptionResponse::from)
            .sorted(Comparator.comparing(StoreOptionResponse::name))
            .toList();
        return new InventoryCategoryResponse(
            category.getId(),
            category.getName(),
            category.isActive(),
            category.isAppliesToAllStores(),
            sortedStores
        );
    }
}
