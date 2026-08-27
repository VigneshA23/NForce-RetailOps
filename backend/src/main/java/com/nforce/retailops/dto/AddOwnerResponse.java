package com.nforce.retailops.dto;

public record AddOwnerResponse(
    Long storeId,
    String storeName,
    String storeLocation,
    Long ownerId,
    String ownerName,
    String ownerEmail
) {
}
