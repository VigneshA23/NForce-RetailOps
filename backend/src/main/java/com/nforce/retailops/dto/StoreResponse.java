package com.nforce.retailops.dto;

public record StoreResponse(
    Long id,
    String name,
    boolean active,
    int employeeCount,
    int taskCount
) {
}
