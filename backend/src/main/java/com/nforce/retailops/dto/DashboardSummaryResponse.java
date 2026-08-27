package com.nforce.retailops.dto;

import java.util.List;

public record DashboardSummaryResponse(
    long totalStores,
    long totalEmployees,
    long activeEmployees,
    long inactiveEmployees,
    List<StoreSummaryResponse> stores
) {
}
