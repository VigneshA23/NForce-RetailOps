package com.nforce.retailops.service;

import com.nforce.retailops.dto.MeResponse;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.StoreOwnerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserProfileService {

    private static final String OWNER_ROLE_NAME = "OWNER_ADMIN";

    private final StoreOwnerRepository storeOwnerRepository;

    public UserProfileService(StoreOwnerRepository storeOwnerRepository) {
        this.storeOwnerRepository = storeOwnerRepository;
    }

    @Transactional(readOnly = true)
    public MeResponse getMe(User user) {
        boolean isOwnerAdmin = user.getRoles().stream().map(Role::getName).anyMatch(OWNER_ROLE_NAME::equals);
        String role = isOwnerAdmin ? "OWNER_ADMIN" : "EMPLOYEE";

        List<String> storeNames = isOwnerAdmin
            ? storeOwnerRepository.findByOwnerId(user.getId()).stream()
                .map(storeOwner -> storeOwner.getStore().getName())
                .toList()
            : List.of();

        return new MeResponse(user.getId(), user.getFullName(), user.getEmail(), role, storeNames);
    }
}
