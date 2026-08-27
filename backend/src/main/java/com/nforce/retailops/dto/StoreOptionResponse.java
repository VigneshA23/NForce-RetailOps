package com.nforce.retailops.dto;

import com.nforce.retailops.entity.Store;

public record StoreOptionResponse(
    Long id,
    String name
) {
    public static StoreOptionResponse from(Store store) {
        return new StoreOptionResponse(store.getId(), store.getName());
    }
}
