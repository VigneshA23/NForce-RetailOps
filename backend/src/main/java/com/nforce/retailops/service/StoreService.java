package com.nforce.retailops.service;

import com.nforce.retailops.dto.StoreRequest;
import com.nforce.retailops.dto.StoreResponse;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
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
        return new StoreResponse(store.getId(), store.getName(), store.isActive(), employeeCount, (int) taskCount);
    }

    @Transactional(readOnly = true)
    public List<StoreResponse> listStores(Long ownerId) {
        return storeOwnerRepository.findByOwnerId(ownerId).stream()
            .map(StoreOwner::getStore)
            .map(store -> toResponse(store, ownerId))
            .toList();
    }

    @Transactional
    public StoreResponse renameStore(Long ownerId, Long storeId, StoreRequest request) {
        StoreOwner storeOwner = storeOwnerRepository.findByStoreIdAndOwnerId(storeId, ownerId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        Store store = storeOwner.getStore();
        store.setName(request.name().trim());
        store = storeRepository.save(store);

        return toResponse(store, ownerId);
    }

    @Transactional
    public void deleteStore(Long ownerId, Long storeId) {
        StoreOwner storeOwner = storeOwnerRepository.findByStoreIdAndOwnerId(storeId, ownerId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        storeOwnerRepository.delete(storeOwner);
        storeRepository.delete(storeOwner.getStore());
    }
}
