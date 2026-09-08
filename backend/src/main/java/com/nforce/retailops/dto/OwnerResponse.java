package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;

import java.time.OffsetDateTime;

public record OwnerResponse(
    Long ownerId,
    String adminCode,
    String ownerName,
    String ownerEmail,
    String ownerPhone,
    String ownerGender,
    boolean ownerActive,
    String avatarUrl,
    Long storeId,
    Long storeCode,
    String storeName,
    String storeLocation,
    Boolean storeActive,
    OffsetDateTime lastLoginAt,
    boolean forcePasswordChange
) {
    // ADM + zero-padded DB id: stable, traceable, no extra sequence needed.
    // NForce never hard-deletes owners (soft-delete convention), so gaps won't occur.
    private static String formatAdminCode(Long id) {
        return String.format("ADM%03d", id);
    }

    public static OwnerResponse from(StoreOwner storeOwner) {
        User owner = storeOwner.getOwner();
        return new OwnerResponse(
            owner.getId(),
            formatAdminCode(owner.getId()),
            owner.getFullName(),
            owner.getEmail(),
            owner.getPhone(),
            owner.getGender(),
            owner.isActive(),
            owner.getAvatarUrl(),
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
            formatAdminCode(owner.getId()),
            owner.getFullName(),
            owner.getEmail(),
            owner.getPhone(),
            owner.getGender(),
            owner.isActive(),
            owner.getAvatarUrl(),
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
