package com.nforce.retailops.service;

import com.nforce.retailops.dto.AssignedStoreResponse;
import com.nforce.retailops.dto.MeResponse;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
public class UserProfileService {

    private static final String OWNER_ROLE_NAME = "OWNER_ADMIN";

    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;

    public UserProfileService(
        StoreOwnerRepository storeOwnerRepository,
        StoreEmployeeRepository storeEmployeeRepository
    ) {
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
    }

    @Transactional(readOnly = true)
    public MeResponse getMe(User user) {
        String role = isOwnerAdmin(user) ? OWNER_ROLE_NAME : "EMPLOYEE";

        List<String> storeNames = accessibleStores(user).stream()
            .map(Store::getName)
            .toList();

        return new MeResponse(user.getId(), user.getFullName(), user.getEmail(), role, storeNames);
    }

    /**
     * The stores the caller may operate on: the ones an owner owns, or the ones
     * an employee is assigned to. This is the only list an employee is allowed
     * to pick a working store from.
     */
    @Transactional(readOnly = true)
    public List<AssignedStoreResponse> listMyStores(User user) {
        return accessibleStores(user).stream()
            .map(AssignedStoreResponse::from)
            .toList();
    }

    /**
     * Guard for any endpoint that takes a store id on an employee's behalf.
     * Masks "not yours" as "not found" so a store id cannot be probed for
     * existence, matching how StoreService and EmployeeService already handle
     * cross-tenant ids.
     */
    @Transactional(readOnly = true)
    public void requireAssignedStore(Long userId, Long storeId) {
        if (!storeEmployeeRepository.existsByEmployeeIdAndStoresId(userId, storeId)) {
            throw new StoreNotFoundException("Store not found");
        }
    }

    private boolean isOwnerAdmin(User user) {
        return user.getRoles().stream().map(Role::getName).anyMatch(OWNER_ROLE_NAME::equals);
    }

    private List<Store> accessibleStores(User user) {
        List<Store> stores = isOwnerAdmin(user)
            ? storeOwnerRepository.findByOwnerId(user.getId()).stream()
                .map(StoreOwner::getStore)
                .toList()
            : storeEmployeeRepository.findByEmployeeId(user.getId())
                .map(storeEmployee -> List.copyOf(storeEmployee.getStores()))
                .orElseGet(List::of);

        return stores.stream()
            .sorted(Comparator.comparing(Store::getName, String.CASE_INSENSITIVE_ORDER))
            .toList();
    }
}
