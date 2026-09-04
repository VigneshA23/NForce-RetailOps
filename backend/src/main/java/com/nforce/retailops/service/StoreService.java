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

import java.util.HashMap;
import java.util.List;
import java.util.Map;

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

    private static Map<Long, Integer> toCountMap(List<Object[]> rows) {
        Map<Long, Integer> counts = new HashMap<>();
        for (Object[] row : rows) {
            counts.put((Long) row[0], ((Long) row[1]).intValue());
        }
        return counts;
    }

    private StoreResponse toResponse(StoreOwner storeOwner, Long ownerId) {
        Store store = storeOwner.getStore();
        int employeeCount = storeEmployeeRepository.countByStoresId(store.getId());
        long taskCount = taskRepository.countByStoreId(store.getId())
            + taskRepository.countByOwnerIdAndAppliesToAllStoresTrue(ownerId);
        return new StoreResponse(store.getId(), store.getStoreCode(), store.getName(), storeOwner.isActive(), employeeCount, (int) taskCount);
    }

    @Transactional(readOnly = true)
    public List<StoreResponse> listStores(Long ownerId) {
        return storeOwnerRepository.findByOwnerIdAndActiveTrue(ownerId)
            .map(storeOwner -> {
                Store store = storeOwner.getStore();
                Long storeId = store.getId();
                List<Long> storeIds = List.of(storeId);
                Map<Long, Integer> employeeCounts = toCountMap(storeEmployeeRepository.countGroupedByStoreIds(storeIds));
                Map<Long, Integer> storeTaskCounts = toCountMap(taskRepository.countGroupedByStoreIds(storeIds));
                long appliesToAllCount = taskRepository.countByOwnerIdAndAppliesToAllStoresTrue(ownerId);
                return List.of(new StoreResponse(
                    storeId,
                    store.getStoreCode(),
                    store.getName(),
                    storeOwner.isActive(),
                    employeeCounts.getOrDefault(storeId, 0),
                    (int) (storeTaskCounts.getOrDefault(storeId, 0) + appliesToAllCount)
                ));
            })
            .orElseGet(List::of);
    }

    @Transactional
    public StoreResponse renameStore(Long storeId, StoreRequest request) {
        StoreOwner storeOwner = storeOwnerRepository.findByStoreId(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        Store store = storeOwner.getStore();
        store.setName(request.name().trim());
        storeRepository.save(store);

        return toResponse(storeOwner, storeOwner.getOwner().getId());
    }

    @Transactional
    public void deleteStore(Long storeId) {
        StoreOwner storeOwner = storeOwnerRepository.findByStoreId(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        storeOwnerRepository.delete(storeOwner);
        storeRepository.delete(storeOwner.getStore());
    }

}
