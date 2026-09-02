package com.nforce.retailops.service;

import com.nforce.retailops.dto.StoreRequest;
import com.nforce.retailops.dto.StoreResponse;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.exception.StoreInactiveException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class StoreService {

    private final StoreRepository storeRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;
    private final TaskRepository taskRepository;

    public StoreService(
        StoreRepository storeRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        TaskRepository taskRepository
    ) {
        this.storeRepository = storeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.taskRepository = taskRepository;
    }

    private StoreResponse toResponse(Store store, Long ownerId) {
        int employeeCount = storeEmployeeRepository.countByStoresId(store.getId());
        long taskCount = taskRepository.countByStoreId(store.getId())
            + taskRepository.countByOwnerIdAndAppliesToAllStoresTrue(ownerId);
        return new StoreResponse(store.getId(), store.getStoreCode(), store.getName(), store.isActive(), employeeCount, (int) taskCount);
    }

    @Transactional(readOnly = true)
    public List<StoreResponse> listStores(Long ownerId) {
        // One round trip instead of four (find-owner-stores, then a separate
        // batched count query per relation): findOwnerStoreSummaryRows
        // pre-aggregates every relation in its own subquery and joins them all
        // together server-side. Each round trip to the database has a real,
        // fixed network cost here, so collapsing four into one is a direct win
        // independent of how fast any single query runs.
        return storeRepository.findOwnerStoreSummaryRows(ownerId).stream()
            .map(row -> new StoreResponse(
                ((Number) row[0]).longValue(),
                ((Number) row[1]).longValue(),
                (String) row[2],
                (Boolean) row[3],
                ((Number) row[4]).intValue(),
                ((Number) row[5]).intValue() + ((Number) row[6]).intValue()
            ))
            .toList();
    }

    @Transactional
    public StoreResponse renameStore(Long ownerId, Long storeId, StoreRequest request) {
        StoreOwner storeOwner = storeOwnerRepository.findByStoreIdAndOwnerId(storeId, ownerId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        Store store = storeOwner.getStore();
        if (!store.isActive()) {
            throw new StoreInactiveException("This store has been deactivated and cannot be edited");
        }
        store.setName(request.name().trim());
        store = storeRepository.save(store);

        return toResponse(store, ownerId);
    }

    @Transactional
    public void deleteStore(Long ownerId, Long storeId) {
        StoreOwner storeOwner = storeOwnerRepository.findByStoreIdAndOwnerId(storeId, ownerId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        if (!storeOwner.getStore().isActive()) {
            throw new StoreInactiveException("This store has been deactivated and cannot be removed");
        }

        storeOwnerRepository.delete(storeOwner);
        storeRepository.delete(storeOwner.getStore());
    }
}
