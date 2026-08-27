package com.nforce.retailops.dto;

<<<<<<< Updated upstream
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
=======
public record EmployeeResponse(
    Long id,
    String empId,
    String fullName,
    String email,
    String phone,
    String shift,
    String employmentType,
    String gender,
    boolean active,
    Long storeId,
    String storeName
) {
>>>>>>> Stashed changes
}
