package com.nforce.retailops.dto;

public record StoreSummaryResponse(
    Long id,
    String name,
    String location,
    boolean active,
    long employeeCount
) {
}
