package com.nforce.retailops.service;

import com.nforce.retailops.dto.AddOwnerRequest;
import com.nforce.retailops.dto.AddOwnerResponse;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmailAlreadyExistsException;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OwnerProvisioningService {

    private static final String OWNER_ROLE_NAME = "OWNER_ADMIN";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final StoreRepository storeRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final PasswordEncoder passwordEncoder;

    public OwnerProvisioningService(
        UserRepository userRepository,
        RoleRepository roleRepository,
        StoreRepository storeRepository,
        StoreOwnerRepository storeOwnerRepository,
        PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.storeRepository = storeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public AddOwnerResponse addOwner(AddOwnerRequest request) {
        if (userRepository.findByEmailWithRoles(request.ownerEmail()).isPresent()) {
            throw new EmailAlreadyExistsException("A user with this email already exists");
        }

        Role ownerRole = roleRepository.findByName(OWNER_ROLE_NAME)
            .orElseThrow(() -> new IllegalStateException(OWNER_ROLE_NAME + " role is not seeded"));

        User owner = new User();
        owner.setFullName(request.ownerName());
        owner.setEmail(request.ownerEmail());
        owner.setPasswordHash(passwordEncoder.encode(request.password()));
        owner.getRoles().add(ownerRole);
        owner = userRepository.save(owner);

        Store store = new Store();
        store.setName(request.storeName());
        store.setLocation(request.storeLocation());
        store = storeRepository.save(store);

        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store);
        storeOwner.setOwner(owner);
        storeOwnerRepository.save(storeOwner);

        return new AddOwnerResponse(
            store.getId(),
            store.getName(),
            store.getLocation(),
            owner.getId(),
            owner.getFullName(),
            owner.getEmail()
        );
    }
}
