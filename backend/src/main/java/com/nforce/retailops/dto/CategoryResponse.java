package com.nforce.retailops.dto;

import com.nforce.retailops.entity.Category;

public record CategoryResponse(
    Long id,
    String name,
    int displayOrder,
    boolean active,
    int taskCount
) {
    public static CategoryResponse from(Category category, int taskCount) {
        return new CategoryResponse(
            category.getId(),
            category.getName(),
            category.getDisplayOrder(),
            category.isActive(),
            taskCount
        );
    }
}
