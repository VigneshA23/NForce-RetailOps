package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StoreEmployee;

import java.util.Comparator;
import java.util.List;

public record SuperAdminEmployeeResponse(
    Long id,
    String empId,
    String name,
    String email,
    String phone,
    String shift,
    String employeeType,
    String gender,
    boolean active,
    List<StoreOptionResponse> stores,
    Long ownerId,
    String ownerName
) {
    // Owner attribution comes from StoreEmployee.createdByOwner, which every
    // employee-creation path (EmployeeProvisioningService) always sets -- there
    // is no other route to create one, so no fallback lookup is needed here.
    public static SuperAdminEmployeeResponse from(
        StoreEmployee storeEmployee, List<StoreOptionResponse> stores, Long ownerId, String ownerName
    ) {
        List<StoreOptionResponse> sortedStores = stores.stream()
            .sorted(Comparator.comparing(StoreOptionResponse::name))
            .toList();

        return new SuperAdminEmployeeResponse(
            storeEmployee.getId(),
            "EMP-" + String.format("%03d", storeEmployee.getId()),
            storeEmployee.getEmployee().getFullName(),
            storeEmployee.getEmployee().getEmail(),
            storeEmployee.getPhone(),
            storeEmployee.getShift(),
            storeEmployee.getEmployeeType(),
            storeEmployee.getGender(),
            storeEmployee.getEmployee().isActive(),
            sortedStores,
            ownerId,
            ownerName
        );
    }
}
