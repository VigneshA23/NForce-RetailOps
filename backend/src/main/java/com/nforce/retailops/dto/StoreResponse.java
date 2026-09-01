package com.nforce.retailops.dto;

public record StoreResponse(
    Long id,
    Long storeCode,
    String name,
    boolean active,
    int employeeCount,
    int taskCount
) {
}
