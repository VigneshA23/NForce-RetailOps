package com.nforce.retailops.dto;

import java.util.List;

public record EmployeeChecklistCategoryResponse(
    Long categoryId,
    String categoryName,
    List<EmployeeTaskItemResponse> tasks
) {
}
