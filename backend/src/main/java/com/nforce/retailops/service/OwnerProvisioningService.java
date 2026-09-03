package com.nforce.retailops.service;

import com.nforce.retailops.dto.AddOwnerRequest;
import com.nforce.retailops.dto.OwnerResponse;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmailAlreadyExistsException;
import com.nforce.retailops.exception.InvalidOwnerRequestException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persists (and, on mail failure, un-persists/reverts) the owner account work
 * from {@link OwnerManagementService#addOwner}, each in its own short-lived
 * transaction. See {@link EmployeeProvisioningService} for why this has to be
 * a separate bean rather than same-class private methods: Spring's
 * proxy-based {@code @Transactional} is silently a no-op on self-invocation.
 */
@Service
public class OwnerProvisioningService {

    public record ProvisionedOwner(
        Long ownerId,
        String email,
        String fullName,
        String temporaryPassword,
        Long storeOwnerId,
        Long newStoreId,
        Long previousOwnerIdIfReassigned,
        OwnerResponse response
    ) {}

    private static final String OWNER_ROLE_NAME = "OWNER_ADMIN";

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final StoreRepository storeRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final PasswordEncoder passwordEncoder;
    private final TemporaryPasswordGenerator temporaryPasswordGenerator;
    private final StoreCodeGenerator storeCodeGenerator;

    public OwnerProvisioningService(
        UserRepository userRepository,
        RoleRepository roleRepository,
        StoreRepository storeRepository,
        StoreOwnerRepository storeOwnerRepository,
        PasswordEncoder passwordEncoder,
        TemporaryPasswordGenerator temporaryPasswordGenerator,
        StoreCodeGenerator storeCodeGenerator
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.storeRepository = storeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.passwordEncoder = passwordEncoder;
        this.temporaryPasswordGenerator = temporaryPasswordGenerator;
        this.storeCodeGenerator = storeCodeGenerator;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ProvisionedOwner createOwnerAccount(AddOwnerRequest request, boolean hasNewStore, boolean hasExistingStore) {
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

        StoreOwner storeOwner = null;
        Long newStoreId = null;
        Long previousOwnerId = null;
        if (hasNewStore) {
            Store store = new Store();
            store.setName(request.storeName());
            store.setLocation(request.storeLocation());
            store.setStoreCode(storeCodeGenerator.next());
            store = storeRepository.save(store);
            newStoreId = store.getId();

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
            previousOwnerId = storeOwner.getOwner().getId();
            storeOwner.setOwner(owner);
            storeOwner.setActive(true);
            storeOwner = storeOwnerRepository.save(storeOwner);
        }

        OwnerResponse response = storeOwner != null ? OwnerResponse.from(storeOwner) : OwnerResponse.withoutStore(owner);

        return new ProvisionedOwner(
            owner.getId(),
            owner.getEmail(),
            owner.getFullName(),
            temporaryPassword,
            storeOwner != null ? storeOwner.getId() : null,
            newStoreId,
            previousOwnerId,
            response
        );
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deleteUnreachableOwner(ProvisionedOwner provisioned) {
        if (provisioned.newStoreId() != null) {
            // Both the link and the store were created fresh in this request,
            // and nothing else could have referenced the store yet.
            storeOwnerRepository.deleteById(provisioned.storeOwnerId());
            storeRepository.deleteById(provisioned.newStoreId());
        } else if (provisioned.previousOwnerIdIfReassigned() != null) {
            // This StoreOwner row was repossessed, not created -- owner_id is
            // NOT NULL, so "revoked" always means active=false with the last
            // real owner still on the row. Revert to exactly that shape rather
            // than deleting it.
            StoreOwner storeOwner = storeOwnerRepository.findById(provisioned.storeOwnerId())
                .orElseThrow(() -> new IllegalStateException(
                    "Reassigned store-owner link " + provisioned.storeOwnerId() + " vanished during compensation"));
            storeOwner.setOwner(userRepository.getReferenceById(provisioned.previousOwnerIdIfReassigned()));
            storeOwner.setActive(false);
            storeOwnerRepository.save(storeOwner);
        }

        userRepository.deleteById(provisioned.ownerId());
    }
}
