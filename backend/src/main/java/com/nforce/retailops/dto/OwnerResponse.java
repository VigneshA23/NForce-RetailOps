package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;

public record OwnerResponse(
    Long ownerId,
    String ownerName,
    String ownerEmail,
    boolean ownerActive,
    Long storeId,
    Long storeCode,
    String storeName,
    String storeLocation,
    Boolean storeActive
) {
    public static OwnerResponse from(StoreOwner storeOwner) {
        return new OwnerResponse(
            storeOwner.getOwner().getId(),
            storeOwner.getOwner().getFullName(),
            storeOwner.getOwner().getEmail(),
            storeOwner.getOwner().isActive(),
            storeOwner.getStore().getId(),
            storeOwner.getStore().getStoreCode(),
            storeOwner.getStore().getName(),
            storeOwner.getStore().getLocation(),
            storeOwner.isActive()
        );
    }

    public static OwnerResponse withoutStore(User owner) {
        return new OwnerResponse(
            owner.getId(),
            owner.getFullName(),
            owner.getEmail(),
            owner.isActive(),
            null,
            null,
            null,
            null,
            null
        );
    }
}
