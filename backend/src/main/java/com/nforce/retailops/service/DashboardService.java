package com.nforce.retailops.service;

import com.nforce.retailops.dto.DashboardSummaryResponse;
import com.nforce.retailops.dto.StoreResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class DashboardService {

    private final StoreService storeService;

    public DashboardService(StoreService storeService) {
        this.storeService = storeService;
    }

    @Transactional(readOnly = true)
    public DashboardSummaryResponse getSummary(Long ownerId) {
        List<StoreResponse> stores = storeService.listStores(ownerId);
        long totalEmployees = stores.stream().mapToLong(StoreResponse::employeeCount).sum();
        return new DashboardSummaryResponse(stores.size(), totalEmployees, stores);
    }
}
