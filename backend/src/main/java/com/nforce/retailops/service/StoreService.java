package com.nforce.retailops.service;

import com.nforce.retailops.dto.CreateStoreRequest;
import com.nforce.retailops.dto.StoreRequest;
import com.nforce.retailops.dto.StoreResponse;
import com.nforce.retailops.dto.SuperAdminStoreResponse;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.OwnerNotFoundException;
import com.nforce.retailops.exception.OwnerStoreConflictException;
import com.nforce.retailops.exception.StoreAlreadyExistsException;
import com.nforce.retailops.exception.StoreHasHistoryException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.UserRepository;
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
    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public StoreService(
        StoreRepository storeRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        TaskRepository taskRepository,
        TaskResponseEntryRepository taskResponseEntryRepository,
        StoreCodeGenerator storeCodeGenerator,
        NotificationService notificationService,
        UserRepository userRepository
    ) {
        this.storeRepository = storeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.taskRepository = taskRepository;
        this.taskResponseEntryRepository = taskResponseEntryRepository;
        this.storeCodeGenerator = storeCodeGenerator;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
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
        return storeOwnerRepository.findByOwnerIdAndActiveTrue(ownerId)
            .map(storeOwner -> {
                Store store = storeOwner.getStore();
                Long storeId = store.getId();
                List<Long> storeIds = List.of(storeId);
                Map<Long, Integer> employeeCounts = toCountMap(storeEmployeeRepository.countActiveGroupedByStoreIds(storeIds));
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
    // (or was last) linked to. Starts from Store (left-joining StoreOwner/owner)
    // rather than from StoreOwner, so a store with no StoreOwner row at all is
    // still included instead of silently dropped -- see findAllWithOptionalStoreOwner.
    @Transactional(readOnly = true)
    public List<SuperAdminStoreResponse> listAllStoresForSuperAdmin() {
        List<Object[]> rows = storeRepository.findAllWithOptionalStoreOwner();
        if (rows.isEmpty()) {
            return List.of();
        }

        List<Long> storeIds = rows.stream().map(row -> ((Store) row[0]).getId()).toList();
        Map<Long, Integer> employeeCounts = toCountMap(storeEmployeeRepository.countActiveGroupedByStoreIds(storeIds));
        Map<Long, Integer> storeTaskCounts = toCountMap(taskRepository.countGroupedByStoreIds(storeIds));

        Set<Long> ownerIds = rows.stream()
            .map(row -> (User) row[2])
            .filter(java.util.Objects::nonNull)
            .map(User::getId)
            .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, Integer> appliesAllCounts = toCountMap(taskRepository.countAppliesToAllGroupedByOwnerIds(ownerIds));

        return rows.stream()
            .map(row -> {
                Store store = (Store) row[0];
                StoreOwner storeOwner = (StoreOwner) row[1];
                User owner = (User) row[2];
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
                    owner != null ? owner.getAvatarUrl() : null,
                    owner != null ? owner.isActive() : null,
                    owner != null && storeOwner.isActive(),
                    employeeCounts.getOrDefault(store.getId(), 0),
                    taskCount
                );
            })
            .sorted(Comparator.comparing(SuperAdminStoreResponse::storeName, String.CASE_INSENSITIVE_ORDER))
            .toList();
    }

    // Super Admin edits a store's own details -- name and, optionally, location.
    // Location is optional in the request so a name-only rename doesn't wipe
    // out an existing location.
    @Transactional
    public SuperAdminStoreResponse updateStore(Long storeId, StoreRequest request) {
        StoreOwner storeOwner = storeOwnerRepository.findByStoreId(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        Store store = storeOwner.getStore();
        String newName = request.name().trim();
        String newLocation = request.location() != null ? request.location().trim() : store.getLocation();
        if (storeRepository.existsByNameAndLocationIgnoreCaseAndIdNot(newName, newLocation, store.getId())) {
            throw new StoreAlreadyExistsException("A store with this name and location already exists");
        }
        store.setName(newName);
        store.setLocation(newLocation);
        store = storeRepository.save(store);

        User owner = storeOwner.getOwner();
        int employeeCount = storeEmployeeRepository.countByStoresIdAndEmployeeActiveTrue(store.getId());
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
            owner != null ? owner.getAvatarUrl() : null,
            owner != null ? owner.isActive() : null,
            owner != null && storeOwner.isActive(),
            employeeCount,
            (int) taskCount
        );
    }

    // Super Admin toggles the store's OWN open/closed status. Distinct from
    // OwnerManagementService.setStoreActive, which revokes an owner's access to a
    // store while leaving the store itself untouched -- this is the other
    // direction. Deactivating the store now also releases its owner link (see
    // below), the same cascade OwnerManagementService.setOwnerActive already
    // applies when the OWNER is deactivated instead of the store.
    @Transactional
    public SuperAdminStoreResponse setStoreActive(Long storeId, boolean active) {
        Store store = storeRepository.findById(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        store.setActive(active);
        store = storeRepository.save(store);

        StoreOwner storeOwner = storeOwnerRepository.findByStoreId(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        User notifiedOwner = storeOwner.getOwner();
        if (notifiedOwner != null) {
            notificationService.createForStoreStatus(store, notifiedOwner, active);
        }

        if (!active) {
            // Fully releases the store's owner link -- same shape as a never-owned
            // store (owner=null, active=false), not just marking the link inactive
            // while leaving the owner reference in place. Without this, the owner
            // would stay "assigned" to a closed store indefinitely, unable to be
            // handed a different one, and the closed store would never surface as
            // reassignable (StoreOwnerRepository.findAllWithRevokedAccess) once
            // it's reactivated. Reactivating the store deliberately does NOT
            // restore this link -- only an explicit reassignment can.
            storeOwner.setActive(false);
            // Recorded before nulling so employees keep seeing this owner's
            // configured tasks (StoreOwner.resolveTaskOwnerId) even though
            // the live link below is fully released.
            storeOwner.setLastOwner(storeOwner.getOwner());
            storeOwner.setOwner(null);
            storeOwner = storeOwnerRepository.save(storeOwner);
        }

        User owner = storeOwner.getOwner();
        int employeeCount = storeEmployeeRepository.countByStoresIdAndEmployeeActiveTrue(store.getId());
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
            owner != null ? owner.getAvatarUrl() : null,
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

    // Super Admin assigns or reassigns an owner to a store.
    // Guard: the target owner must not already manage a DIFFERENT active store.
    // Reassignment is reflected immediately in both the Stores and Owners tables
    // because both read from the same store_owners row.
    @Transactional
    public SuperAdminStoreResponse assignOwnerToStore(Long storeId, Long newOwnerId) {
        StoreOwner storeOwner = storeOwnerRepository.findByStoreId(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        User newOwner = userRepository.findById(newOwnerId)
            .orElseThrow(() -> new OwnerNotFoundException("Owner not found"));

        Long currentOwnerId = storeOwner.getOwner() != null ? storeOwner.getOwner().getId() : null;
        boolean changingOwner = !newOwnerId.equals(currentOwnerId);
        if (changingOwner && storeOwnerRepository.existsByOwnerIdAndActiveTrueAndStoreIdNot(newOwnerId, storeId)) {
            throw new OwnerStoreConflictException(
                "This owner already manages an active store. Reassign or deactivate their current store first.");
        }

        storeOwner.setOwner(newOwner);
        storeOwner.setActive(true);
        storeOwner = storeOwnerRepository.save(storeOwner);

        Store store = storeOwner.getStore();
        int employeeCount = storeEmployeeRepository.countByStoresIdAndEmployeeActiveTrue(store.getId());
        long taskCount = taskRepository.countByStoreId(store.getId())
            + taskRepository.countByOwnerIdAndAppliesToAllStoresTrue(newOwner.getId());

        return new SuperAdminStoreResponse(
            store.getId(),
            store.getStoreCode(),
            store.getName(),
            store.getLocation(),
            store.isActive(),
            newOwner.getId(),
            newOwner.getFullName(),
            newOwner.getAvatarUrl(),
            newOwner.isActive(),
            true,
            employeeCount,
            (int) taskCount
        );
    }

    // Super Admin creates a store with no owner yet -- active = false on the
    // StoreOwner row, the same shape as a revoked-access store, so it's
    // immediately picked up by the "existing store" list when a new owner is
    // created (OwnerManagementService.listReassignableStores).
    @Transactional
    public SuperAdminStoreResponse createUnownedStore(CreateStoreRequest request) {
        String name = request.name().trim();
        String location = request.location().trim();
        if (storeRepository.existsByNameAndLocationIgnoreCase(name, location)) {
            throw new StoreAlreadyExistsException("A store with this name and location already exists");
        }
        Store store = new Store();
        store.setName(name);
        store.setLocation(location);
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
            null,
            false,
            0,
            0
        );
    }

}
