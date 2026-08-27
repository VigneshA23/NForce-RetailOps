package com.nforce.retailops.service;

import com.nforce.retailops.dto.DashboardSummaryResponse;
import com.nforce.retailops.dto.StoreSummaryResponse;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class DashboardService {

    private final StoreAccessService storeAccessService;
    private final StoreEmployeeRepository storeEmployeeRepository;

    public DashboardService(StoreAccessService storeAccessService, StoreEmployeeRepository storeEmployeeRepository) {
        this.storeAccessService = storeAccessService;
        this.storeEmployeeRepository = storeEmployeeRepository;
    }

    @Transactional(readOnly = true)
    public List<StoreSummaryResponse> listOwnedStores(User admin) {
        return storeAccessService.getOwnedStores(admin).stream()
            .map(this::toSummary)
            .toList();
    }

    @Transactional(readOnly = true)
    public DashboardSummaryResponse getSummary(User admin) {
        List<StoreSummaryResponse> stores = listOwnedStores(admin);

        List<Long> ownedStoreIds = storeAccessService.getOwnedStoreIds(admin);
        List<StoreEmployee> employees = storeEmployeeRepository.findByStore_IdIn(ownedStoreIds);
        long activeEmployees = employees.stream().filter(se -> se.getEmployee().isActive()).count();

        return new DashboardSummaryResponse(
            stores.size(),
            employees.size(),
            activeEmployees,
            employees.size() - activeEmployees,
            stores
        );
    }

    private StoreSummaryResponse toSummary(Store store) {
        long employeeCount = storeEmployeeRepository.countByStore_Id(store.getId());
        return new StoreSummaryResponse(store.getId(), store.getName(), store.getLocation(), store.isActive(), employeeCount);
    }
}
