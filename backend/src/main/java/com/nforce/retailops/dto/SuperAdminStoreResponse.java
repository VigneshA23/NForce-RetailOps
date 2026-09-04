package com.nforce.retailops.dto;

public record SuperAdminStoreResponse(
    Long storeId,
    Long storeCode,
    String storeName,
    String storeLocation,
    boolean storeActive,
    // Null for a store that has never had an owner.
    Long ownerId,
    String ownerName,
    Boolean ownerActive,
    // False both when there's no owner at all, and when an owner is/was
    // assigned but their access to this specific store has been revoked --
    // i.e. whether ownerName currently represents someone who can actually
    // manage this store.
    boolean ownerAccessActive,
    int employeeCount,
    int taskCount
) {
}
