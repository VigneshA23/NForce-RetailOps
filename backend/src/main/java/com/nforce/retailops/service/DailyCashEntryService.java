package com.nforce.retailops.service;

import com.nforce.retailops.dto.DailyCashEntryRequest;
import com.nforce.retailops.dto.DailyCashEntryResponse;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.entity.DailyCashEntryCorrection;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.DailyCashEntryNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.DailyCashEntryCorrectionRepository;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

// Daily cash entry. Owner/Admin writes to their own active store; Super Admin
// picks a store explicitly. One row per store + date; a re-save updates it in
// place and appends the prior values to daily_cash_entry_corrections (the
// first save writes none).
@Service
public class DailyCashEntryService {

    private final DailyCashEntryRepository entryRepository;
    private final DailyCashEntryCorrectionRepository correctionRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final SuperAdminRepository superAdminRepository;

    public DailyCashEntryService(
        DailyCashEntryRepository entryRepository,
        DailyCashEntryCorrectionRepository correctionRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreRepository storeRepository,
        UserRepository userRepository,
        SuperAdminRepository superAdminRepository
    ) {
        this.entryRepository = entryRepository;
        this.correctionRepository = correctionRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeRepository = storeRepository;
        this.userRepository = userRepository;
        this.superAdminRepository = superAdminRepository;
    }

    // ---- Owner/Admin: own store -------------------------------------------

    @Transactional
    public DailyCashEntryResponse save(Long ownerId, DailyCashEntryRequest request) {
        Store store = requireActiveStoreOwner(ownerId).getStore();
        return saveEntry(store, userRepository.getReferenceById(ownerId), null, request);
    }

    @Transactional(readOnly = true)
    public DailyCashEntryResponse get(Long ownerId, LocalDate date) {
        return getEntry(requireActiveStoreOwner(ownerId).getStore().getId(), date);
    }

    // ---- Super Admin: any store, chosen explicitly ------------------------

    @Transactional
    public DailyCashEntryResponse saveForSuperAdmin(Long superAdminId, Long storeId, DailyCashEntryRequest request) {
        Store store = storeRepository.findById(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        return saveEntry(store, null, superAdminRepository.getReferenceById(superAdminId), request);
    }

    @Transactional(readOnly = true)
    public DailyCashEntryResponse getForSuperAdmin(Long storeId, LocalDate date) {
        Store store = storeRepository.findById(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        return getEntry(store.getId(), date);
    }

    // ---- shared ------------------------------------------------------------

    // Exactly one of user / superAdmin is non-null.
    private DailyCashEntryResponse saveEntry(
        Store store, User user, SuperAdmin superAdmin, DailyCashEntryRequest request
    ) {
        store = storeRepository.lockByStoreId(store.getId())
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        LocalDate date = request.businessDate() != null ? request.businessDate() : LocalDate.now();
        OffsetDateTime now = OffsetDateTime.now();
        DailyCashEntry entry = entryRepository
            .lockByStoreIdAndBusinessDate(store.getId(), date)
            .orElse(null);

        if (entry == null) {
            entry = new DailyCashEntry();
            entry.setStore(store);
            entry.setBusinessDate(date);
            entry.setEnteredByUser(user);
            entry.setEnteredBySuperAdmin(superAdmin);
            entry.setEnteredAt(now);
        } else {
            correctionRepository.save(DailyCashEntryCorrection.snapshotOf(entry, user, superAdmin, now));
        }

        entry.setTotalCashSales(request.totalCashSales());
        entry.setOpeningDrawerCash(request.openingDrawerCash());
        entry.setCashRemoved(request.cashRemoved());
        entry.setCashRemaining(request.cashRemaining());
        entry.setCashExpenses(request.cashExpenses());
        entry.setBankDeposits(request.bankDeposits());
        entry.setOtherAdjustments(request.otherAdjustments());
        entry.setUpdatedByUser(user);
        entry.setUpdatedBySuperAdmin(superAdmin);
        entry.setUpdatedAt(now);
        return toResponse(entryRepository.save(entry));
    }

    private DailyCashEntryResponse getEntry(Long storeId, LocalDate date) {
        LocalDate businessDate = date != null ? date : LocalDate.now();
        DailyCashEntry entry = entryRepository
            .findByStoreIdAndBusinessDate(storeId, businessDate)
            .orElseThrow(() -> new DailyCashEntryNotFoundException("No cash entry for " + businessDate));
        return toResponse(entry);
    }

    // Same multi-store-safe pick as StockCheckService.requireActiveStoreOwner.
    private StoreOwner requireActiveStoreOwner(Long ownerId) {
        return storeOwnerRepository.findByOwnerId(ownerId).stream()
            .filter(StoreOwner::isActive)
            .findFirst()
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
    }

    private static Long id(User u) { return u == null ? null : u.getId(); }
    private static Long id(SuperAdmin s) { return s == null ? null : s.getId(); }

    private DailyCashEntryResponse toResponse(DailyCashEntry e) {
        List<DailyCashEntryResponse.Correction> history = correctionRepository
            .findByEntryIdOrderByCorrectedAtAscIdAsc(e.getId()).stream()
            .map(c -> new DailyCashEntryResponse.Correction(
                c.getId(),
                c.getPreviousTotalCashSales(),
                c.getPreviousOpeningDrawerCash(),
                c.getPreviousCashRemoved(),
                c.getPreviousCashRemaining(),
                c.getPreviousCashExpenses(),
                c.getPreviousBankDeposits(),
                c.getPreviousOtherAdjustments(),
                id(c.getPreviousUpdatedByUser()),
                id(c.getPreviousUpdatedBySuperAdmin()),
                c.getPreviousUpdatedAt(),
                id(c.getCorrectedByUser()),
                id(c.getCorrectedBySuperAdmin()),
                c.getCorrectedAt()))
            .toList();
        return new DailyCashEntryResponse(
            e.getId(),
            e.getStore().getId(),
            e.getBusinessDate(),
            e.getTotalCashSales(),
            e.getOpeningDrawerCash(),
            e.getCashRemoved(),
            e.getCashRemaining(),
            e.getCashExpenses(),
            e.getBankDeposits(),
            e.getOtherAdjustments(),
            id(e.getEnteredByUser()),
            id(e.getEnteredBySuperAdmin()),
            e.getEnteredAt(),
            id(e.getUpdatedByUser()),
            id(e.getUpdatedBySuperAdmin()),
            e.getUpdatedAt(),
            history);
    }
}
