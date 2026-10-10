package com.nforce.retailops.dto;

import com.nforce.retailops.entity.Supplier;

import java.util.Comparator;
import java.util.List;

public record SupplierResponse(
    Long id,
    String name,
    boolean active,
    String contact,
    String location,
    boolean appliesToAllStores,
    List<StoreOptionResponse> stores
) {
    public static SupplierResponse from(Supplier supplier) {
        List<StoreOptionResponse> sortedStores = supplier.getStores().stream()
            .map(StoreOptionResponse::from)
            .sorted(Comparator.comparing(StoreOptionResponse::name))
            .toList();
        return new SupplierResponse(
            supplier.getId(),
            supplier.getName(),
            supplier.isActive(),
            supplier.getContact(),
            supplier.getLocation(),
            supplier.isAppliesToAllStores(),
            sortedStores
        );
    }
}
