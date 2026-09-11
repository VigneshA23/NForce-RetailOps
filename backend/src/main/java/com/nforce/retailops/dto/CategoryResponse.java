package com.nforce.retailops.dto;

import com.nforce.retailops.entity.Category;

import java.util.Comparator;
import java.util.List;

public record CategoryResponse(
    Long id,
    String name,
    int displayOrder,
    boolean active,
    int taskCount,
    boolean appliesToAllStores,
    List<StoreOptionResponse> stores,
    Long createdByOwnerId,
    String createdByOwnerName
) {
    public static CategoryResponse from(Category category, int taskCount, List<StoreOptionResponse> stores) {
        List<StoreOptionResponse> sortedStores = stores.stream()
            .sorted(Comparator.comparing(StoreOptionResponse::name))
            .toList();

        Long ownerId = category.getOwner() != null ? category.getOwner().getId() : null;
        String ownerName = category.getOwner() != null ? category.getOwner().getFullName() : "Super Admin";

        return new CategoryResponse(
            category.getId(),
            category.getName(),
            category.getDisplayOrder(),
            category.isActive(),
            taskCount,
            category.isAppliesToAllStores(),
            sortedStores,
            ownerId,
            ownerName
        );
    }
}
