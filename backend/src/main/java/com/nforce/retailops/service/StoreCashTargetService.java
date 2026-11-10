package com.nforce.retailops.service;

import com.nforce.retailops.dto.StoreCashTargetRequest;
import com.nforce.retailops.dto.StoreCashTargetResponse;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreCashTarget;
import com.nforce.retailops.entity.StoreCashTargetChange;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StoreCashTargetChangeRepository;
import com.nforce.retailops.repository.StoreCashTargetRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

// Per-store target cash-drawer amount. Owner/Admin reads/updates their own
// active store; Super Admin any store. A store with no row yet gets one on
// first read/write, picking up the DB column default -- so the target is
// never missing and callers (e.g. Daily Cash Entry) never block on it.
// Expected-cash / variance code should call getTargetAmount(storeId).
@Service
public class StoreCashTargetService {

    private final StoreCashTargetRepository targetRepository;
    private final StoreCashTargetChangeRepository changeRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final SuperAdminRepository superAdminRepository;

    public StoreCashTargetService(
        StoreCashTargetRepository targetRepository,
        StoreCashTargetChangeRepository changeRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreRepository storeRepository,
        UserRepository userRepository,
        SuperAdminRepository superAdminRepository
    ) {
        this.targetRepository = targetRepository;
        this.changeRepository = changeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeRepository = storeRepository;
        this.userRepository = userRepository;
        this.superAdminRepository = superAdminRepository;
    }

    // ---- Owner/Admin: own store -------------------------------------------

    @Transactional
    public StoreCashTargetResponse get(Long ownerId) {
        return toResponse(findOrCreate(requireActiveStore(ownerId)));
    }

    @Transactional
    public StoreCashTargetResponse update(Long ownerId, StoreCashTargetRequest request) {
        Store store = requireActiveStore(ownerId);
        return apply(store, userRepository.getReferenceById(ownerId), null, request);
    }

    // ---- Super Admin: any store -------------------------------------------

    @Transactional
    public StoreCashTargetResponse getForSuperAdmin(Long storeId) {
        return toResponse(findOrCreate(requireStore(storeId)));
    }

    @Transactional
    public StoreCashTargetResponse updateForSuperAdmin(Long superAdminId, Long storeId, StoreCashTargetRequest request) {
        return apply(requireStore(storeId), null, superAdminRepository.getReferenceById(superAdminId), request);
    }

    // ---- For other services (expected cash, variance) ---------------------

    @Transactional
    public BigDecimal getTargetAmount(Long storeId) {
        return findOrCreate(requireStore(storeId)).getTargetAmount();
    }

    // ---- shared ------------------------------------------------------------

    // Exactly one of user / superAdmin is non-null.
    private StoreCashTargetResponse apply(Store store, User user, SuperAdmin superAdmin, StoreCashTargetRequest request) {
        StoreCashTarget target = findOrCreate(store);
        BigDecimal newAmount = request.targetAmount();
        if (target.getTargetAmount().compareTo(newAmount) == 0) {
            return toResponse(target); // no change, no audit row
        }
        OffsetDateTime now = OffsetDateTime.now();

        StoreCashTargetChange change = new StoreCashTargetChange();
        change.setStore(store);
        change.setPreviousAmount(target.getTargetAmount());
        change.setNewAmount(newAmount);
        change.setChangedByUser(user);
        change.setChangedBySuperAdmin(superAdmin);
        change.setChangedAt(now);
        changeRepository.save(change);

        target.setTargetAmount(newAmount);
        target.setUpdatedByUser(user);
        target.setUpdatedBySuperAdmin(superAdmin);
        target.setUpdatedAt(now);
        return toResponse(targetRepository.save(target));
    }

    // The new row's amount comes from the DB default, read back on insert.
    private StoreCashTarget findOrCreate(Store store) {
        return targetRepository.findByStoreId(store.getId()).orElseGet(() -> {
            StoreCashTarget created = new StoreCashTarget();
            created.setStore(store);
            StoreCashTarget saved = targetRepository.saveAndFlush(created);
            if (saved.getTargetAmount() == null) {
                saved.setTargetAmount(targetRepository.findAmountByStoreId(store.getId()));
            }
            return saved;
        });
    }

    private Store requireStore(Long storeId) {
        return storeRepository.findById(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
    }

    private Store requireActiveStore(Long ownerId) {
        return storeOwnerRepository.findByOwnerId(ownerId).stream()
            .filter(StoreOwner::isActive)
            .findFirst()
            .orElseThrow(() -> new StoreNotFoundException("Store not found"))
            .getStore();
    }

    private StoreCashTargetResponse toResponse(StoreCashTarget t) {
        return new StoreCashTargetResponse(
            t.getStore().getId(),
            t.getTargetAmount(),
            t.getUpdatedByUser() == null ? null : t.getUpdatedByUser().getId(),
            t.getUpdatedBySuperAdmin() == null ? null : t.getUpdatedBySuperAdmin().getId(),
            t.getUpdatedAt());
    }
}
