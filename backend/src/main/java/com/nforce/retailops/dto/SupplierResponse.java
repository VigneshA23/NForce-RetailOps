package com.nforce.retailops.dto;

import com.nforce.retailops.entity.Supplier;

public record SupplierResponse(
    Long id,
    String name,
    boolean active
) {
    public static SupplierResponse from(Supplier supplier) {
        return new SupplierResponse(supplier.getId(), supplier.getName(), supplier.isActive());
    }
}
