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
    boolean active,
    List<StoreOptionResponse> stores
) {
    public static EmployeeResponse from(StoreEmployee storeEmployee) {
        List<StoreOptionResponse> stores = storeEmployee.getStores().stream()
            .map(StoreOptionResponse::from)
            .toList();
        return from(storeEmployee, stores);
    }

    // Takes a pre-loaded store list instead of reading storeEmployee.getStores()
    // itself, so a caller mapping many employees at once (listEmployees) can
    // batch-load every employee's stores in one query up front rather than
    // paying one lazy-load query per employee here.
    public static EmployeeResponse from(StoreEmployee storeEmployee, List<StoreOptionResponse> stores) {
        List<StoreOptionResponse> sortedStores = stores.stream()
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
            storeEmployee.getEmployee().isActive(),
            sortedStores
        );
    }
}
