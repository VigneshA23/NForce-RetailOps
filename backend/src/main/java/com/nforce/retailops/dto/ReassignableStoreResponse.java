package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StoreOwner;

public record ReassignableStoreResponse(
    Long storeId,
    Long storeCode,
    String storeName,
    String storeLocation,
    String currentOwnerName
) {
    public static ReassignableStoreResponse from(StoreOwner storeOwner) {
        return new ReassignableStoreResponse(
            storeOwner.getStore().getId(),
            storeOwner.getStore().getStoreCode(),
            storeOwner.getStore().getName(),
            storeOwner.getStore().getLocation(),
            storeOwner.getOwner().getFullName()
        );
    }
}
