package com.nforce.retailops.dto;

public record SuperAdminStoreResponse(
    Long storeId,
    Long storeCode,
    String storeName,
    String storeLocation,
    boolean storeActive,
    Long ownerId,
    String ownerName,
    boolean ownerActive,
    int employeeCount,
    int taskCount
) {
}
