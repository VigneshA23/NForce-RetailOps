package com.nforce.retailops.dto;

import java.util.List;

public record EmployeeSearchResponse(List<EmployeeSearchItem> tasks, List<EmployeeSearchItem> issues) {}
