package com.nforce.retailops.service;

import com.nforce.retailops.dto.CreateStoreRequest;
import com.nforce.retailops.dto.StoreRequest;
import com.nforce.retailops.dto.StoreResponse;
import com.nforce.retailops.dto.SuperAdminStoreResponse;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.StoreHasHistoryException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class StoreService {

    private final StoreRepository storeRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;
    private final TaskRepository taskRepository;
    private final TaskResponseEntryRepository taskResponseEntryRepository;
    private final StoreCodeGenerator storeCodeGenerator;

    public StoreService(
        StoreRepository storeRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        TaskRepository taskRepository,
        TaskResponseEntryRepository taskResponseEntryRepository,
        StoreCodeGenerator storeCodeGenerator
    ) {
        this.storeRepository = storeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.taskRepository = taskRepository;
        this.taskResponseEntryRepository = taskResponseEntryRepository;
        this.storeCodeGenerator = storeCodeGenerator;
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
            + (ownerId != null ? taskRepository.countByOwnerIdAndAppliesToAllStoresTrue(ownerId) : 0);
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

    // Read-only, cross-owner directory for the Super Admin's Stores page --
    // every store platform-wide, active or not, with the owner it's currently
    // (or was last) linked to. findAllWithStoreAndOwner fetch-joins both sides
    // of StoreOwner, so this stays a fixed number of queries regardless of
    // store count.
    @Transactional(readOnly = true)
    public List<SuperAdminStoreResponse> listAllStoresForSuperAdmin() {
        List<StoreOwner> storeOwners = storeOwnerRepository.findAllWithStoreAndOwner();
        if (storeOwners.isEmpty()) {
            return List.of();
        }

        List<Long> storeIds = storeOwners.stream().map(so -> so.getStore().getId()).toList();
        Map<Long, Integer> employeeCounts = toCountMap(storeEmployeeRepository.countGroupedByStoreIds(storeIds));
        Map<Long, Integer> storeTaskCounts = toCountMap(taskRepository.countGroupedByStoreIds(storeIds));

        Set<Long> ownerIds = storeOwners.stream()
            .map(StoreOwner::getOwner)
            .filter(java.util.Objects::nonNull)
            .map(User::getId)
            .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, Integer> appliesAllCounts = toCountMap(taskRepository.countAppliesToAllGroupedByOwnerIds(ownerIds));

        return storeOwners.stream()
            .map(storeOwner -> {
                Store store = storeOwner.getStore();
                User owner = storeOwner.getOwner();
                int taskCount = storeTaskCounts.getOrDefault(store.getId(), 0)
                    + (owner != null ? appliesAllCounts.getOrDefault(owner.getId(), 0) : 0);
                return new SuperAdminStoreResponse(
                    store.getId(),
                    store.getStoreCode(),
                    store.getName(),
                    store.getLocation(),
                    store.isActive(),
                    owner != null ? owner.getId() : null,
                    owner != null ? owner.getFullName() : null,
                    owner != null ? owner.isActive() : null,
                    owner != null && storeOwner.isActive(),
                    employeeCounts.getOrDefault(store.getId(), 0),
                    taskCount
                );
            })
            .sorted(Comparator.comparing(SuperAdminStoreResponse::storeName, String.CASE_INSENSITIVE_ORDER))
            .toList();
    }

    @Transactional
    public StoreResponse renameStore(Long storeId, StoreRequest request) {
        StoreOwner storeOwner = storeOwnerRepository.findByStoreId(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        Store store = storeOwner.getStore();
        store.setName(request.name().trim());
        storeRepository.save(store);

        Long ownerId = storeOwner.getOwner() != null ? storeOwner.getOwner().getId() : null;
        return toResponse(storeOwner, ownerId);
    }

    // Super Admin toggles the store's OWN open/closed status -- distinct from
    // (and must never touch) StoreOwner.active, which OwnerManagementService.
    // setStoreActive uses for a completely different feature: revoking an
    // owner's access to a store while leaving the store itself untouched.
    @Transactional
    public SuperAdminStoreResponse setStoreActive(Long storeId, boolean active) {
        Store store = storeRepository.findById(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        store.setActive(active);
        store = storeRepository.save(store);

        StoreOwner storeOwner = storeOwnerRepository.findByStoreId(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        User owner = storeOwner.getOwner();
        int employeeCount = storeEmployeeRepository.countByStoresId(store.getId());
        long taskCount = taskRepository.countByStoreId(store.getId())
            + (owner != null ? taskRepository.countByOwnerIdAndAppliesToAllStoresTrue(owner.getId()) : 0);

        return new SuperAdminStoreResponse(
            store.getId(),
            store.getStoreCode(),
            store.getName(),
            store.getLocation(),
            store.isActive(),
            owner != null ? owner.getId() : null,
            owner != null ? owner.getFullName() : null,
            owner != null ? owner.isActive() : null,
            owner != null && storeOwner.isActive(),
            employeeCount,
            (int) taskCount
        );
    }

    @Transactional
    public void deleteStore(Long storeId) {
        StoreOwner storeOwner = storeOwnerRepository.findByStoreId(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        if (taskResponseEntryRepository.existsByStoreId(storeId)
                || taskRepository.countByStoreId(storeId) > 0) {
            throw new StoreHasHistoryException(
                "This store has checklist history and cannot be deleted. Deactivate it instead.");
        }

        storeOwnerRepository.delete(storeOwner);
        storeRepository.delete(storeOwner.getStore());
    }

    // Super Admin creates a store with no owner yet -- active = false on the
    // StoreOwner row, the same shape as a revoked-access store, so it's
    // immediately picked up by the "existing store" list when a new owner is
    // created (OwnerManagementService.listReassignableStores).
    @Transactional
    public SuperAdminStoreResponse createUnownedStore(CreateStoreRequest request) {
        Store store = new Store();
        store.setName(request.name().trim());
        store.setLocation(request.location().trim());
        store.setStoreCode(storeCodeGenerator.next());
        store = storeRepository.save(store);

        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store);
        storeOwner.setActive(false);
        storeOwnerRepository.save(storeOwner);

        return new SuperAdminStoreResponse(
            store.getId(),
            store.getStoreCode(),
            store.getName(),
            store.getLocation(),
            store.isActive(),
            null,
            null,
            null,
            false,
            0,
            0
        );
    }

}
