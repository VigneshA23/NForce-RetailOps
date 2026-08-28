package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StoreEmployee;

import java.util.Comparator;
import java.util.List;

public record EmployeeResponse(
    Long id,
    String empId,
    String name,
    String email,
    String phone,
    String shift,
    String employeeType,
    String gender,
    List<StoreOptionResponse> stores
) {
    public static EmployeeResponse from(StoreEmployee storeEmployee) {
        List<StoreOptionResponse> stores = storeEmployee.getStores().stream()
            .map(StoreOptionResponse::from)
            .sorted(Comparator.comparing(StoreOptionResponse::name))
            .toList();

        return new EmployeeResponse(
            storeEmployee.getId(),
            "EMP-" + String.format("%03d", storeEmployee.getId()),
            storeEmployee.getEmployee().getFullName(),
            storeEmployee.getEmployee().getEmail(),
            storeEmployee.getPhone(),
            storeEmployee.getShift(),
            storeEmployee.getEmployeeType(),
            storeEmployee.getGender(),
            stores
        );
    }
}
