package com.nforce.retailops.dto;

import com.nforce.retailops.entity.Store;

public record EmployeeStoreResponse(
    Long id,
    String name,
    boolean active
) {
    public static EmployeeStoreResponse from(Store store) {
        return new EmployeeStoreResponse(store.getId(), store.getName(), store.isActive());
    }
}
