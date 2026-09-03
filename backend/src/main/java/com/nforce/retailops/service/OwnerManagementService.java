package com.nforce.retailops.service;

import com.nforce.retailops.dto.AddOwnerRequest;
import com.nforce.retailops.dto.AssignStoreRequest;
import com.nforce.retailops.dto.OwnerResponse;
import com.nforce.retailops.dto.ReassignableStoreResponse;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmailAlreadyExistsException;
import com.nforce.retailops.exception.InvalidOwnerRequestException;
import com.nforce.retailops.exception.OwnerNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class OwnerManagementService {

    private static final String OWNER_ROLE_NAME = "OWNER_ADMIN";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final StoreRepository storeRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final PasswordEncoder passwordEncoder;
    private final TemporaryPasswordGenerator temporaryPasswordGenerator;
    private final MailService mailService;
    private final StoreCodeGenerator storeCodeGenerator;

    public OwnerManagementService(
        UserRepository userRepository,
        RoleRepository roleRepository,
        StoreRepository storeRepository,
        StoreOwnerRepository storeOwnerRepository,
        PasswordEncoder passwordEncoder,
        TemporaryPasswordGenerator temporaryPasswordGenerator,
        MailService mailService,
        StoreCodeGenerator storeCodeGenerator
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.storeRepository = storeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.passwordEncoder = passwordEncoder;
        this.temporaryPasswordGenerator = temporaryPasswordGenerator;
        this.mailService = mailService;
        this.storeCodeGenerator = storeCodeGenerator;
    }

    @Transactional(readOnly = true)
    public List<OwnerResponse> listOwners() {
        List<OwnerResponse> result = new ArrayList<>();
        for (User owner : userRepository.findAllOwners()) {
            List<StoreOwner> stores = storeOwnerRepository.findByOwnerId(owner.getId());
            if (stores.isEmpty()) {
                result.add(OwnerResponse.withoutStore(owner));
            } else {
                stores.forEach(storeOwner -> result.add(OwnerResponse.from(storeOwner)));
            }
        }
        return result;
    }

    @Transactional(readOnly = true)
    public long peekNextStoreCode() {
        return storeCodeGenerator.peek();
    }

    @Transactional(readOnly = true)
    public List<ReassignableStoreResponse> listReassignableStores() {
        return storeOwnerRepository.findAllWithRevokedAccess().stream()
            .map(ReassignableStoreResponse::from)
            .toList();
    }

    @Transactional
    public OwnerResponse addOwner(AddOwnerRequest request) {
        if (userRepository.findByEmailWithRoles(request.ownerEmail()).isPresent()) {
            throw new EmailAlreadyExistsException("A user with this email already exists");
        }

        boolean hasNewStoreName = request.storeName() != null && !request.storeName().isBlank();
        boolean hasNewStoreLocation = request.storeLocation() != null && !request.storeLocation().isBlank();
        if (hasNewStoreName != hasNewStoreLocation) {
            throw new InvalidOwnerRequestException("Provide both store name and location, or leave both blank");
        }
        boolean hasNewStore = hasNewStoreName;
        boolean hasExistingStore = request.existingStoreId() != null;
        if (hasNewStore && hasExistingStore) {
            throw new InvalidOwnerRequestException("Choose either a new store or an existing store, not both");
        }

        Role ownerRole = roleRepository.findByName(OWNER_ROLE_NAME)
            .orElseThrow(() -> new IllegalStateException(OWNER_ROLE_NAME + " role is not seeded"));

        String temporaryPassword = temporaryPasswordGenerator.generate();

        User owner = new User();
        owner.setFullName(request.ownerName());
        owner.setEmail(request.ownerEmail());
        owner.setPasswordHash(passwordEncoder.encode(temporaryPassword));
        owner.setMustResetPassword(true);
        owner.getRoles().add(ownerRole);
        owner = userRepository.save(owner);

        StoreOwner storeOwner = null;
        if (hasNewStore) {
            Store store = new Store();
            store.setName(request.storeName());
            store.setLocation(request.storeLocation());
            store.setStoreCode(storeCodeGenerator.next());
            store = storeRepository.save(store);

            storeOwner = new StoreOwner();
            storeOwner.setStore(store);
            storeOwner.setOwner(owner);
            storeOwner = storeOwnerRepository.save(storeOwner);
        } else if (hasExistingStore) {
            storeOwner = storeOwnerRepository.findByStoreId(request.existingStoreId())
                .orElseThrow(() -> new StoreNotFoundException("Store not found"));
            if (storeOwner.isActive()) {
                throw new InvalidOwnerRequestException("That store is not available for reassignment");
            }
            storeOwner.setOwner(owner);
            storeOwner.setActive(true);
            storeOwner = storeOwnerRepository.save(storeOwner);
        }

        // Thrown on failure, which rolls back the account and any store change above --
        // an owner must not be left unable to ever learn their own password.
        mailService.sendTemporaryPassword(owner.getEmail(), owner.getFullName(), temporaryPassword);

        return storeOwner != null ? OwnerResponse.from(storeOwner) : OwnerResponse.withoutStore(owner);
    }

    @Transactional
    public OwnerResponse assignStore(Long ownerId, AssignStoreRequest request) {
        User owner = userRepository.findById(ownerId)
            .orElseThrow(() -> new OwnerNotFoundException("Owner not found"));

        Store store = new Store();
        store.setName(request.storeName());
        store.setLocation(request.storeLocation());
        store.setStoreCode(storeCodeGenerator.next());
        store = storeRepository.save(store);

        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store);
        storeOwner.setOwner(owner);
        storeOwner = storeOwnerRepository.save(storeOwner);

        return OwnerResponse.from(storeOwner);
    }

    @Transactional
    public List<OwnerResponse> setOwnerActive(Long ownerId, boolean active) {
        User owner = userRepository.findById(ownerId)
            .orElseThrow(() -> new OwnerNotFoundException("Owner not found"));
        owner.setActive(active);
        userRepository.save(owner);

        List<StoreOwner> storeOwners = storeOwnerRepository.findByOwnerId(ownerId);
        if (storeOwners.isEmpty()) {
            return List.of(OwnerResponse.withoutStore(owner));
        }
        return storeOwners.stream().map(OwnerResponse::from).toList();
    }

    @Transactional
    public List<OwnerResponse> setStoreActive(Long ownerId, Long storeId, boolean active) {
        StoreOwner storeOwner = storeOwnerRepository.findByStoreIdAndOwnerId(storeId, ownerId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        storeOwner.setActive(active);
        storeOwnerRepository.save(storeOwner);

        return storeOwnerRepository.findByOwnerId(ownerId).stream()
            .map(OwnerResponse::from)
            .toList();
    }
}
