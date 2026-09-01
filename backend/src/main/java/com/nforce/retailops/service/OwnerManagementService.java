package com.nforce.retailops.service;

import com.nforce.retailops.dto.AddOwnerRequest;
import com.nforce.retailops.dto.AssignStoreRequest;
import com.nforce.retailops.dto.OwnerResponse;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmailAlreadyExistsException;
import com.nforce.retailops.exception.OwnerNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class OwnerManagementService {

    private static final String OWNER_ROLE_NAME = "OWNER_ADMIN";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final StoreRepository storeRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final PasswordEncoder passwordEncoder;

    public OwnerManagementService(
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

    @Transactional(readOnly = true)
    public List<OwnerResponse> listOwners() {
        return storeOwnerRepository.findAllWithStoreAndOwner().stream()
            .map(OwnerResponse::from)
            .toList();
    }

    @Transactional
    public OwnerResponse addOwner(AddOwnerRequest request) {
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
        storeOwner = storeOwnerRepository.save(storeOwner);

        return OwnerResponse.from(storeOwner);
    }

    @Transactional
    public OwnerResponse assignStore(Long ownerId, AssignStoreRequest request) {
        List<StoreOwner> existingStores = storeOwnerRepository.findByOwnerId(ownerId);
        if (existingStores.isEmpty()) {
            throw new OwnerNotFoundException("Owner not found");
        }

        User owner = existingStores.get(0).getOwner();

        Store store = new Store();
        store.setName(request.storeName());
        store.setLocation(request.storeLocation());
        store = storeRepository.save(store);

        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store);
        storeOwner.setOwner(owner);
        storeOwner = storeOwnerRepository.save(storeOwner);

        return OwnerResponse.from(storeOwner);
    }

    @Transactional
    public List<OwnerResponse> setOwnerActive(Long ownerId, boolean active) {
        List<StoreOwner> storeOwners = storeOwnerRepository.findByOwnerId(ownerId);
        if (storeOwners.isEmpty()) {
            throw new OwnerNotFoundException("Owner not found");
        }

        User owner = storeOwners.get(0).getOwner();
        owner.setActive(active);
        userRepository.save(owner);

        return storeOwners.stream().map(OwnerResponse::from).toList();
    }

    @Transactional
    public List<OwnerResponse> setStoreActive(Long ownerId, Long storeId, boolean active) {
        StoreOwner storeOwner = storeOwnerRepository.findByStoreIdAndOwnerId(storeId, ownerId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        Store store = storeOwner.getStore();
        store.setActive(active);
        storeRepository.save(store);

        return storeOwnerRepository.findByOwnerId(ownerId).stream()
            .map(OwnerResponse::from)
            .toList();
    }
}
