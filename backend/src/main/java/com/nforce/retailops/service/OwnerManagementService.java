package com.nforce.retailops.service;

import com.nforce.retailops.dto.AddOwnerRequest;
import com.nforce.retailops.dto.AssignStoreRequest;
import com.nforce.retailops.dto.OwnerCreationResponse;
import com.nforce.retailops.dto.OwnerResponse;
import com.nforce.retailops.dto.ReassignableStoreResponse;
import com.nforce.retailops.dto.UpdateOwnerRequest;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmailDeliveryException;
import com.nforce.retailops.exception.InvalidOwnerRequestException;
import com.nforce.retailops.exception.OwnerNotFoundException;
import com.nforce.retailops.exception.OwnerStoreConflictException;
import com.nforce.retailops.exception.StoreAlreadyExistsException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import com.nforce.retailops.security.SuperAdminUserDetails;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
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
    private final NotificationService notificationService;
    private final SuperAdminAlertService superAdminAlertService;
    private final SessionService sessionService;
    private final ActivityLogService activityLogService;
    private final PasswordResetService passwordResetService;
    private final String appBaseUrl;

    public OwnerManagementService(
        UserRepository userRepository,
        StoreRepository storeRepository,
        StoreOwnerRepository storeOwnerRepository,
        MailService mailService,
        StoreCodeGenerator storeCodeGenerator,
        OwnerProvisioningService ownerProvisioningService,
        NotificationService notificationService,
        SuperAdminAlertService superAdminAlertService,
        SessionService sessionService,
        ActivityLogService activityLogService,
        PasswordResetService passwordResetService,
        @Value("${app.base-url}") String appBaseUrl
    ) {
        this.userRepository = userRepository;
        this.storeRepository = storeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.mailService = mailService;
        this.storeCodeGenerator = storeCodeGenerator;
        this.ownerProvisioningService = ownerProvisioningService;
        this.notificationService = notificationService;
        this.superAdminAlertService = superAdminAlertService;
        this.sessionService = sessionService;
        this.activityLogService = activityLogService;
        this.passwordResetService = passwordResetService;
        this.appBaseUrl = appBaseUrl;
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
    // duration of that external HTTP call. Email failure does not roll back
    // the account -- the caller receives emailSent=false and can share the
    // temporary password shown in the UI directly with the new owner.
    public OwnerCreationResponse addOwner(AddOwnerRequest request) {
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

        OwnerProvisioningService.ProvisionedOwner provisioned =
            ownerProvisioningService.createOwnerAccount(request, hasNewStore, hasExistingStore);

        boolean emailSent = false;
        try {
            String token = passwordResetService.createSetupToken(provisioned.email());
            mailService.sendAccountSetupEmail(provisioned.email(), provisioned.fullName(), appBaseUrl + "?token=" + token);
            emailSent = true;
        } catch (EmailDeliveryException ex) {
            log.warn("Setup email failed for owner {} ({}); account still created", provisioned.fullName(), provisioned.ownerId(), ex);
            try {
                Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
                if (principal instanceof SuperAdminUserDetails saDetails) {
                    superAdminAlertService.notifyOwnerEmailDeliveryFailed(saDetails.getSuperAdmin(), provisioned.fullName());
                }
            } catch (RuntimeException notifEx) {
                log.warn("Could not send OWNER_EMAIL_FAILED notification for owner {}", provisioned.ownerId(), notifEx);
            }
        }

        activityLogService.logPlatform(
            "OWNER_CREATED", "Super Admin", "SUPER_ADMIN",
            "OWNER", provisioned.fullName(),
            "Created admin \"" + provisioned.fullName() + "\""
        );

        return new OwnerCreationResponse(provisioned.response(), null, emailSent);
    }

    @Transactional
    public OwnerResponse assignStore(Long ownerId, AssignStoreRequest request) {
        User owner = userRepository.findById(ownerId)
            .orElseThrow(() -> new OwnerNotFoundException("Owner not found"));

        if (!owner.isActive()) {
            throw new InvalidOwnerRequestException("Cannot assign a store to a deactivated owner");
        }

        if (storeOwnerRepository.existsByOwnerIdAndActiveTrue(ownerId)) {
            throw new OwnerStoreConflictException(
                "This owner already has an active store assigned. Deactivate their current store first before assigning a new one.");
        }

        boolean hasNewStoreName = request.storeName() != null && !request.storeName().isBlank();
        boolean hasNewStoreLocation = request.storeLocation() != null && !request.storeLocation().isBlank();
        if (hasNewStoreName != hasNewStoreLocation) {
            throw new InvalidOwnerRequestException("Provide both store name and location, or leave both blank");
        }
        boolean hasNewStore = hasNewStoreName;
        boolean hasExistingStore = request.existingStoreId() != null;
        if (hasNewStore == hasExistingStore) {
            throw new InvalidOwnerRequestException("Choose either a new store or an existing store");
        }

        StoreOwner storeOwner;
        if (hasNewStore) {
            if (storeRepository.existsByNameAndLocationIgnoreCase(request.storeName(), request.storeLocation())) {
                throw new StoreAlreadyExistsException(
                    "A store with this name and location already exists");
            }
            Store store = new Store();
            store.setName(request.storeName());
            store.setLocation(request.storeLocation());
            store.setStoreCode(storeCodeGenerator.next());
            store = storeRepository.save(store);

            storeOwner = new StoreOwner();
            storeOwner.setStore(store);
            storeOwner.setOwner(owner);
            storeOwner = storeOwnerRepository.save(storeOwner);
        } else {
            storeOwner = storeOwnerRepository.findByStoreId(request.existingStoreId())
                .orElseThrow(() -> new StoreNotFoundException("Store not found"));
            if (storeOwner.isActive()) {
                throw new InvalidOwnerRequestException("That store is not available for reassignment");
            }
            storeOwner.setOwner(owner);
            storeOwner.setActive(true);
            // Resolves any pending owner-vacancy notification for this store --
            // the same/new owner is now active again, whether or not 24h have
            // already passed since it became ownerless.
            storeOwner.setOwnerVacantSince(null);
            storeOwner = storeOwnerRepository.save(storeOwner);
        }

        activityLogService.log(
            "STORE_ASSIGNED", "Super Admin", "SUPER_ADMIN",
            storeOwner.getStore().getId(), storeOwner.getStore().getName(), "OWNER", owner.getFullName(),
            "Assigned " + owner.getFullName() + " to " + storeOwner.getStore().getName()
        );

        return OwnerResponse.from(storeOwner);
    }

    @Transactional
    public List<OwnerResponse> updateOwner(Long ownerId, UpdateOwnerRequest request) {
        User owner = userRepository.findById(ownerId)
            .orElseThrow(() -> new OwnerNotFoundException("Owner not found"));
        owner.setFullName(request.ownerName());
        owner.setEmail(request.ownerEmail());
        userRepository.save(owner);

        List<StoreOwner> storeOwners = storeOwnerRepository.findByOwnerId(ownerId);
        if (storeOwners.isEmpty()) {
            return List.of(OwnerResponse.withoutStore(owner));
        }
        return storeOwners.stream().map(OwnerResponse::from).toList();
    }

    @Transactional
    public List<OwnerResponse> setOwnerActive(Long ownerId, boolean active) {
        User owner = userRepository.findById(ownerId)
            .orElseThrow(() -> new OwnerNotFoundException("Owner not found"));
        owner.setActive(active);
        userRepository.save(owner);
        notificationService.createForAccountStatus(owner, active);

        List<StoreOwner> storeOwners = storeOwnerRepository.findByOwnerId(ownerId);
        activityLogService.logForStores(
            active ? "OWNER_ACTIVATED" : "OWNER_DEACTIVATED", "Super Admin", "SUPER_ADMIN",
            storeOwners.stream().map(StoreOwner::getStore).toList(), "OWNER", owner.getFullName(),
            (active ? "Activated admin \"" : "Deactivated admin \"") + owner.getFullName() + "\""
        );
        if (!active) {
            // Deactivating the owner fully releases their store link(s) --
            // same shape as a never-owned store (owner=null, active=false),
            // not just a per-store toggle (setStoreActive(false) keeps the
            // owner reference). This is what makes the store surface as
            // "unassigned" in findAllWithRevokedAccess, and stops it from
            // silently reappearing against this owner (even as "Inactive")
            // if/when they're reactivated -- reactivation must never
            // auto-restore a previous assignment, only an explicit Add Store
            // pick can.
            storeOwners.forEach(storeOwner -> {
                storeOwner.setActive(false);
                // Recorded before nulling so employees keep seeing this owner's
                // configured tasks (StoreOwner.resolveTaskOwnerId) even though
                // the live link below is fully released.
                storeOwner.setLastOwner(storeOwner.getOwner());
                storeOwner.setOwner(null);
                storeOwner.setOwnerVacantSince(OffsetDateTime.now());
            });
            storeOwnerRepository.saveAll(storeOwners);
            return List.of(OwnerResponse.withoutStore(owner));
        }
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
        storeOwner.setOwnerVacantSince(active ? null : OffsetDateTime.now());
        storeOwnerRepository.save(storeOwner);

        activityLogService.log(
            active ? "STORE_ACTIVATED" : "STORE_DEACTIVATED", "Super Admin", "SUPER_ADMIN",
            storeOwner.getStore().getId(), storeOwner.getStore().getName(), "STORE", storeOwner.getStore().getName(),
            (active ? "Activated store \"" : "Deactivated store \"") + storeOwner.getStore().getName() + "\""
        );

        return storeOwnerRepository.findByOwnerId(ownerId).stream()
            .map(OwnerResponse::from)
            .toList();
    }

    @Transactional
    public void deleteOwner(Long ownerId) {
        User owner = userRepository.findById(ownerId)
            .orElseThrow(() -> new OwnerNotFoundException("Owner not found"));

        // Release every store this owner was linked to the same way setOwnerActive(false)
        // does: active=false, not just owner_id going null via the FK's ON DELETE SET NULL
        // below. Without this, a hard-deleted owner's store keeps active=true with no
        // owner, so it never satisfies findAllWithRevokedAccess's "active = false" check
        // and silently disappears from the Existing Store picker while the store itself
        // stays active. (last_owner_id/owner_id are left for the DB cascade to null out --
        // pointing them at a user we're about to delete would just be undone by it anyway.)
        List<StoreOwner> storeOwners = storeOwnerRepository.findByOwnerId(ownerId);
        storeOwners.forEach(storeOwner -> {
            storeOwner.setActive(false);
            storeOwner.setOwnerVacantSince(OffsetDateTime.now());
        });
        storeOwnerRepository.saveAll(storeOwners);

        // Token stops working immediately; DB cascade/set-null (V42) handles
        // the FK cleanup when the user row is deleted below.
        sessionService.invalidateAllForUser(owner.getEmail());
        userRepository.delete(owner);
    }
}
