package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;

import java.time.OffsetDateTime;

public record OwnerResponse(
    Long ownerId,
    String ownerName,
    String ownerEmail,
    boolean ownerActive,
    Long storeId,
    Long storeCode,
    String storeName,
    String storeLocation,
    Boolean storeActive,
    OffsetDateTime lastLoginAt,
    boolean forcePasswordChange
) {
    public static OwnerResponse from(StoreOwner storeOwner) {
        User owner = storeOwner.getOwner();
        return new OwnerResponse(
            owner.getId(),
            owner.getFullName(),
            owner.getEmail(),
            owner.isActive(),
            storeOwner.getStore().getId(),
            storeOwner.getStore().getStoreCode(),
            storeOwner.getStore().getName(),
            storeOwner.getStore().getLocation(),
            storeOwner.isActive(),
            owner.getLastLoginAt(),
            owner.isForcePasswordChange()
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
            null,
            owner.getLastLoginAt(),
            owner.isForcePasswordChange()
        );
    }
}
