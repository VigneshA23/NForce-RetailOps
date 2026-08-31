package com.nforce.retailops.dto;

import com.nforce.retailops.entity.Store;

public record AssignedStoreResponse(
    Long id,
    String name,
    String location,
    boolean active
) {
    public static AssignedStoreResponse from(Store store) {
        return new AssignedStoreResponse(
            store.getId(),
            store.getName(),
            store.getLocation(),
            store.isActive()
        );
    }
}
