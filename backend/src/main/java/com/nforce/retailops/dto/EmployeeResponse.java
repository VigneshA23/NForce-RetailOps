package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StoreEmployee;

public record EmployeeResponse(
    Long id,
    String empId,
    String name,
    String email,
    String phone,
    String shift,
    String employeeType,
    String gender,
    Long storeId,
    String storeName
) {
    public static EmployeeResponse from(StoreEmployee storeEmployee) {
        return new EmployeeResponse(
            storeEmployee.getId(),
            "EMP-" + String.format("%03d", storeEmployee.getId()),
            storeEmployee.getEmployee().getFullName(),
            storeEmployee.getEmployee().getEmail(),
            storeEmployee.getPhone(),
            storeEmployee.getShift(),
            storeEmployee.getEmployeeType(),
            storeEmployee.getGender(),
            storeEmployee.getStore().getId(),
            storeEmployee.getStore().getName()
        );
    }
}
