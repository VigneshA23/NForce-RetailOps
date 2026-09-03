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

    private StoreResponse toResponse(StoreOwner storeOwner, Long ownerId) {
        Store store = storeOwner.getStore();
        int employeeCount = storeEmployeeRepository.countByStoresId(store.getId());
        long taskCount = taskRepository.countByStoreId(store.getId())
            + taskRepository.countByOwnerIdAndAppliesToAllStoresTrue(ownerId);
        return new StoreResponse(store.getId(), store.getStoreCode(), store.getName(), storeOwner.isActive(), employeeCount, (int) taskCount);
    }

    private static Map<Long, Integer> toCountMap(List<Object[]> rows) {
        Map<Long, Integer> counts = new HashMap<>();
        for (Object[] row : rows) {
            counts.put((Long) row[0], ((Long) row[1]).intValue());
        }
        return counts;
    }

    @Transactional(readOnly = true)
    public List<StoreResponse> listStores(Long ownerId) {
        List<StoreOwner> storeOwners = storeOwnerRepository.findByOwnerId(ownerId);
        if (storeOwners.isEmpty()) {
            return List.of();
        }

        // Batched instead of one employee-count + one task-count query per store
        // (N+1), and the "applies to all stores" count no longer gets recomputed
        // redundantly for every store -- it's the same owner-wide number each time.
        List<Long> storeIds = storeOwners.stream().map(so -> so.getStore().getId()).toList();
        Map<Long, Integer> employeeCounts = toCountMap(storeEmployeeRepository.countGroupedByStoreIds(storeIds));
        Map<Long, Integer> storeTaskCounts = toCountMap(taskRepository.countGroupedByStoreIds(storeIds));
        long appliesToAllCount = taskRepository.countByOwnerIdAndAppliesToAllStoresTrue(ownerId);

        return storeOwners.stream()
            .map(storeOwner -> {
                Store store = storeOwner.getStore();
                return new StoreResponse(
                    store.getId(),
                    store.getStoreCode(),
                    store.getName(),
                    storeOwner.isActive(),
                    employeeCounts.getOrDefault(store.getId(), 0),
                    (int) (storeTaskCounts.getOrDefault(store.getId(), 0) + appliesToAllCount)
                );
            })
            .toList();
    }

    @Transactional
    public StoreResponse renameStore(Long ownerId, Long storeId, StoreRequest request) {
        StoreOwner storeOwner = storeOwnerRepository.findByStoreIdAndOwnerId(storeId, ownerId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        if (!storeOwner.isActive()) {
            throw new StoreInactiveException("This store has been deactivated and cannot be edited");
        }
        Store store = storeOwner.getStore();
        store.setName(request.name().trim());
        storeRepository.save(store);

        return toResponse(storeOwner, ownerId);
    }

    @Transactional
    public void deleteStore(Long ownerId, Long storeId) {
        StoreOwner storeOwner = storeOwnerRepository.findByStoreIdAndOwnerId(storeId, ownerId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        if (!storeOwner.isActive()) {
            throw new StoreInactiveException("This store has been deactivated and cannot be removed");
        }

        storeOwnerRepository.delete(storeOwner);
        storeRepository.delete(storeOwner.getStore());
    }

    private Map<Long, Integer> toCountMap(List<Object[]> rows) {
        Map<Long, Integer> map = new HashMap<>();
        for (Object[] row : rows) {
            map.put((Long) row[0], ((Long) row[1]).intValue());
        }
        return map;
    }
}
