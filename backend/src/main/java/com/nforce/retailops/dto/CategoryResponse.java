package com.nforce.retailops.dto;

import com.nforce.retailops.entity.Category;

public record CategoryResponse(
    Long id,
    String name,
    int displayOrder,
    boolean active
) {
    public static CategoryResponse from(Category category) {
        return new CategoryResponse(
            category.getId(),
            category.getName(),
            category.getDisplayOrder(),
            category.isActive()
        );
    }
}
