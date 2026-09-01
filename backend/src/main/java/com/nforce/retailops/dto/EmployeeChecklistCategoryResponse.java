package com.nforce.retailops.dto;

import java.util.List;

public record EmployeeChecklistCategoryResponse(
    Long id,
    String name,
    List<EmployeeTaskResponse> tasks
) {
}
