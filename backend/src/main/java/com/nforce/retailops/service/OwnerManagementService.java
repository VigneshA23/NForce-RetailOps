package com.nforce.retailops.service;

import com.nforce.retailops.dto.AddOwnerRequest;
import com.nforce.retailops.dto.AssignStoreRequest;
import com.nforce.retailops.dto.OwnerResponse;
import com.nforce.retailops.dto.ReassignableStoreResponse;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmailDeliveryException;
import com.nforce.retailops.exception.InvalidOwnerRequestException;
import com.nforce.retailops.exception.OwnerNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class OwnerManagementService {

    private static final Logger log = LoggerFactory.getLogger(OwnerManagementService.class);

    // Generous ceiling for a platform-wide listing ("2-store scale" per CLAUDE.md)
    // while still bounding response size to a fixed worst case.
    private static final int MAX_OWNER_LISTING_ROWS = 500;

    private final UserRepository userRepository;
    private final StoreRepository storeRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final MailService mailService;
    private final StoreCodeGenerator storeCodeGenerator;
    private final OwnerProvisioningService ownerProvisioningService;

    public OwnerManagementService(
        UserRepository userRepository,
        StoreRepository storeRepository,
        StoreOwnerRepository storeOwnerRepository,
        MailService mailService,
        StoreCodeGenerator storeCodeGenerator,
        OwnerProvisioningService ownerProvisioningService
    ) {
        this.userRepository = userRepository;
        this.storeRepository = storeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.mailService = mailService;
        this.storeCodeGenerator = storeCodeGenerator;
        this.ownerProvisioningService = ownerProvisioningService;
    }

    @Transactional(readOnly = true)
    public List<OwnerResponse> listOwners() {
        List<User> owners = userRepository.findAllOwners();
        List<Long> ownerIds = owners.stream().map(User::getId).toList();

        Map<Long, List<StoreOwner>> storeOwnersByOwnerId = ownerIds.isEmpty()
            ? Map.of()
            : storeOwnerRepository.findByOwnerIdInWithStoreAndOwner(ownerIds).stream()
                .collect(Collectors.groupingBy(storeOwner -> storeOwner.getOwner().getId()));

        List<OwnerResponse> result = new ArrayList<>();
        for (User owner : owners) {
            List<StoreOwner> stores = storeOwnersByOwnerId.getOrDefault(owner.getId(), List.of());
            if (stores.isEmpty()) {
                result.add(OwnerResponse.withoutStore(owner));
            } else {
                stores.forEach(storeOwner -> result.add(OwnerResponse.from(storeOwner)));
            }
            if (result.size() >= MAX_OWNER_LISTING_ROWS) {
                log.warn("Owner listing truncated at {} rows", MAX_OWNER_LISTING_ROWS);
                break;
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

    // Deliberately NOT @Transactional: the account (and any store change) is
    // persisted in its own short-lived transaction (OwnerProvisioningService),
    // so the mail send below never holds a pooled DB connection for the
    // duration of that external HTTP call. If mail delivery fails, the account
    // and any store change are explicitly compensated away (in a second short
    // transaction) rather than relying on an implicit rollback -- an owner
    // must not be left unable to ever learn their own password.
    public OwnerResponse addOwner(AddOwnerRequest request) {
        if (userRepository.findByEmailWithRoles(request.ownerEmail()).isPresent()) {
            throw new EmailAlreadyExistsException("A user with this email already exists");
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

        StoreOwner storeOwner = createOrReassignStore(
            owner, request.storeName(), request.storeLocation(), request.existingStoreId());

        return provisioned.response();
    }

    @Transactional
    public OwnerResponse assignStore(Long ownerId, AssignStoreRequest request) {
        User owner = userRepository.findById(ownerId)
            .orElseThrow(() -> new OwnerNotFoundException("Owner not found"));

        StoreOwner storeOwner = createOrReassignStore(
            owner, request.storeName(), request.storeLocation(), request.existingStoreId());
        if (storeOwner == null) {
            throw new InvalidOwnerRequestException("Provide a new store name and location, or select an existing store");
        }

        return OwnerResponse.from(storeOwner);
    }

    // Shared by addOwner (where a store is optional) and assignStore (where it
    // isn't) -- either creates a brand-new store or hands the owner a store
    // whose previous owner's access was revoked (see
    // StoreOwnerRepository.findAllWithRevokedAccess). Returns null only when
    // neither a new-store name/location nor an existingStoreId was given.
    private StoreOwner createOrReassignStore(User owner, String storeName, String storeLocation, Long existingStoreId) {
        boolean hasNewStoreName = storeName != null && !storeName.isBlank();
        boolean hasNewStoreLocation = storeLocation != null && !storeLocation.isBlank();
        if (hasNewStoreName != hasNewStoreLocation) {
            throw new InvalidOwnerRequestException("Provide both store name and location, or leave both blank");
        }
        boolean hasNewStore = hasNewStoreName;
        boolean hasExistingStore = existingStoreId != null;
        if (hasNewStore && hasExistingStore) {
            throw new InvalidOwnerRequestException("Choose either a new store or an existing store, not both");
        }

        if (hasNewStore) {
            Store store = new Store();
            store.setName(storeName);
            store.setLocation(storeLocation);
            store.setStoreCode(storeCodeGenerator.next());
            store = storeRepository.save(store);

            StoreOwner storeOwner = new StoreOwner();
            storeOwner.setStore(store);
            storeOwner.setOwner(owner);
            return storeOwnerRepository.save(storeOwner);
        }

        if (hasExistingStore) {
            StoreOwner storeOwner = storeOwnerRepository.findByStoreId(existingStoreId)
                .orElseThrow(() -> new StoreNotFoundException("Store not found"));
            if (storeOwner.isActive()) {
                throw new InvalidOwnerRequestException("That store is not available for reassignment");
            }
            storeOwner.setOwner(owner);
            storeOwner.setActive(true);
            return storeOwnerRepository.save(storeOwner);
        }

        return null;
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
