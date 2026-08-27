package com.nforce.retailops.service;

import com.nforce.retailops.dto.MeResponse;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserProfileService {

    private static final String OWNER_ROLE_NAME = "OWNER_ADMIN";

    private final StoreAccessService storeAccessService;
    private final StoreEmployeeRepository storeEmployeeRepository;

    public UserProfileService(StoreAccessService storeAccessService, StoreEmployeeRepository storeEmployeeRepository) {
        this.storeAccessService = storeAccessService;
        this.storeEmployeeRepository = storeEmployeeRepository;
    }

    @Transactional(readOnly = true)
    public MeResponse getMe(User user) {
        boolean isOwnerAdmin = user.getRoles().stream().map(Role::getName).anyMatch(OWNER_ROLE_NAME::equals);
        String role = isOwnerAdmin ? "OWNER_ADMIN" : "EMPLOYEE";

        List<String> storeNames = isOwnerAdmin
            ? storeAccessService.getOwnedStores(user).stream().map(Store::getName).toList()
            : storeEmployeeRepository.findByEmployee_Id(user.getId())
                .map(storeEmployee -> List.of(storeEmployee.getStore().getName()))
                .orElseGet(List::of);

        return new MeResponse(user.getId(), user.getFullName(), user.getEmail(), role, storeNames);
    }
}
