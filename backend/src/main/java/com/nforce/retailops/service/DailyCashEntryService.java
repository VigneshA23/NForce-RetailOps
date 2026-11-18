package com.nforce.retailops.service;

import com.nforce.retailops.dto.DailyCashEntryRequest;
import com.nforce.retailops.dto.DailyCashEntryResponse;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.entity.DailyCashEntryCorrection;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.CorrectionReasonRequiredException;
import com.nforce.retailops.exception.DailyCashEntryNotEditableException;
import com.nforce.retailops.exception.DailyCashEntryNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.DailyCashEntryCorrectionRepository;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

// Daily cash entry (five fields). Owner/Admin writes to their own active store; an
// employee to a store they work at (today only, no reason asked); Super Admin
// picks a store explicitly. One row per store + date, never deleted. Changing
// an existing entry is a direct correction: it needs a reason, updates the row
// in place and appends the old values, new values, who, when and why to
// daily_cash_entry_corrections (the first save writes none). No notification
// is sent for a correction; the record lives on the entry and in its history.
// Expected cash and the month's running totals are computed from entries at
// read time, so they reflect a correction straight away.
@Service
public class DailyCashEntryService {

    private final DailyCashEntryRepository entryRepository;
    private final DailyCashEntryCorrectionRepository correctionRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final SuperAdminRepository superAdminRepository;

    public DailyCashEntryService(
        DailyCashEntryRepository entryRepository,
        DailyCashEntryCorrectionRepository correctionRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        StoreRepository storeRepository,
        UserRepository userRepository,
        SuperAdminRepository superAdminRepository
    ) {
        this.entryRepository = entryRepository;
        this.correctionRepository = correctionRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.storeRepository = storeRepository;
        this.userRepository = userRepository;
        this.superAdminRepository = superAdminRepository;
    }

    // ---- Owner/Admin: own store -------------------------------------------

    @Transactional
    public DailyCashEntryResponse save(Long ownerId, DailyCashEntryRequest request) {
        Store store = requireActiveStoreOwner(ownerId).getStore();
        return saveEntry(store, userRepository.getReferenceById(ownerId), null, request, true);
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
        return saveEntry(store, null, superAdminRepository.getReferenceById(superAdminId), request, true);
    }

    @Transactional(readOnly = true)
    public DailyCashEntryResponse getForSuperAdmin(Long storeId, LocalDate date) {
        Store store = storeRepository.findById(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        return getEntry(store.getId(), date);
    }

    // ---- Employee: any store they are assigned to, today only --------------

    // Any store employee may record today's entry or edit it. Every edit lands
    // in the audit trail with who made it and when. (Flagged entries and
    // "only the creator may edit" are later stories.) Unlike a direct correction
    // by an Owner/Admin or Super Admin, an employee is not asked for a reason.
    @Transactional
    public DailyCashEntryResponse saveForEmployee(Long employeeId, Long storeId, DailyCashEntryRequest request) {
        Store store = requireAssignedStore(employeeId, storeId);
        if (request.businessDate() != null && !request.businessDate().equals(LocalDate.now())) {
            throw new DailyCashEntryNotEditableException("Employees can only record cash for today");
        }
        return saveEntry(store, userRepository.getReferenceById(employeeId), null, request, false);
    }

    @Transactional(readOnly = true)
    public DailyCashEntryResponse getForEmployee(Long employeeId, Long storeId, LocalDate date) {
        return getEntry(requireAssignedStore(employeeId, storeId).getId(), date);
    }

    // Masked as "not found" when the store isn't one the employee works at.
    private Store requireAssignedStore(Long employeeId, Long storeId) {
        if (!storeEmployeeRepository.existsByEmployeeIdAndActiveStoreId(employeeId, storeId)) {
            throw new StoreNotFoundException("Store not found");
        }
        return storeRepository.findById(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
    }

    // ---- shared ------------------------------------------------------------

    // Exactly one of user / superAdmin is non-null.
    private DailyCashEntryResponse saveEntry(
        Store store, User user, SuperAdmin superAdmin, DailyCashEntryRequest request, boolean reasonRequired
    ) {
        store = storeRepository.lockByStoreId(store.getId())
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        LocalDate date = request.businessDate() != null ? request.businessDate() : LocalDate.now();
        OffsetDateTime now = OffsetDateTime.now();
        DailyCashEntry entry = entryRepository
            .lockByStoreIdAndBusinessDate(store.getId(), date)
            .orElse(null);

        DailyCashEntryCorrection correction = null;
        String reason = null;
        if (entry == null) {
            entry = new DailyCashEntry();
            entry.setStore(store);
            entry.setBusinessDate(date);
            entry.setEnteredByUser(user);
            entry.setEnteredBySuperAdmin(superAdmin);
            entry.setEnteredAt(now);
        } else {
            if (sameFigures(entry, request)) {
                return toResponse(entry); // nothing to correct, no audit row
            }
            reason = request.correctionReason() == null ? "" : request.correctionReason().trim();
            if (reason.isEmpty() && reasonRequired) {
                throw new CorrectionReasonRequiredException("A reason is required to correct this entry");
            }
            // Old values now; the new values and reason are added once applied.
            correction = DailyCashEntryCorrection.snapshotOf(entry, user, superAdmin, now);
        }

        entry.setOpeningDrawerCash(request.openingDrawerCash());
        entry.setCashRemoved(request.cashRemoved());
        entry.setCashRemaining(request.cashRemaining());
        entry.setCashExpenses(request.cashExpenses());
        entry.setOtherAdjustments(request.otherAdjustments());
        entry.setUpdatedByUser(user);
        entry.setUpdatedBySuperAdmin(superAdmin);
        entry.setUpdatedAt(now);
        entry = entryRepository.save(entry);
        if (correction != null) {
            correction.recordCorrection(entry, reason == null || reason.isEmpty() ? null : reason);
            correctionRepository.save(correction);
        }
        return toResponse(entry);
    }

    private static boolean sameFigures(DailyCashEntry e, DailyCashEntryRequest r) {
        return same(e.getOpeningDrawerCash(), r.openingDrawerCash())
            && same(e.getCashRemoved(), r.cashRemoved())
            && same(e.getCashRemaining(), r.cashRemaining())
            && same(e.getCashExpenses(), r.cashExpenses())
            && same(e.getOtherAdjustments(), r.otherAdjustments());
    }

    private static boolean same(java.math.BigDecimal a, java.math.BigDecimal b) {
        return a.compareTo(b) == 0;
    }

    private static String name(User u, SuperAdmin s) {
        if (u != null) return u.getFullName();
        if (s != null) return s.getName();
        return null;
    }

    private DailyCashEntryResponse getEntry(Long storeId, LocalDate date) {
        LocalDate businessDate = date != null ? date : LocalDate.now();
        DailyCashEntry entry = entryRepository
            .findByStoreIdAndBusinessDate(storeId, businessDate)
            .orElseThrow(() -> new DailyCashEntryNotFoundException("No cash entry for " + businessDate));
        return toResponse(entry);
    }

    // The store this Owner/Admin request is about (see OwnerStoreScope).
    private StoreOwner requireActiveStoreOwner(Long ownerId) {
        return OwnerStoreScope.requireLink(storeOwnerRepository, ownerId);
    }

    private static Long id(User u) { return u == null ? null : u.getId(); }
    private static Long id(SuperAdmin s) { return s == null ? null : s.getId(); }

    private DailyCashEntryResponse toResponse(DailyCashEntry e) {
        List<DailyCashEntryResponse.Correction> history = correctionRepository
            .findByEntryIdOrderByCorrectedAtAscIdAsc(e.getId()).stream()
            .map(c -> new DailyCashEntryResponse.Correction(
                c.getId(),
                c.getPreviousOpeningDrawerCash(),
                c.getPreviousCashExpenses(),
                c.getPreviousCashRemoved(),
                c.getPreviousCashRemaining(),
                c.getPreviousOtherAdjustments(),
                id(c.getPreviousUpdatedByUser()),
                id(c.getPreviousUpdatedBySuperAdmin()),
                c.getPreviousUpdatedAt(),
                id(c.getCorrectedByUser()),
                id(c.getCorrectedBySuperAdmin()),
                c.getCorrectedAt(),
                name(c.getCorrectedByUser(), c.getCorrectedBySuperAdmin()),
                c.getReason(),
                c.getNewOpeningDrawerCash(),
                c.getNewCashExpenses(),
                c.getNewCashRemoved(),
                c.getNewCashRemaining(),
                c.getNewOtherAdjustments()))
            .toList();
        DailyCashEntryResponse.Correction latest = history.isEmpty() ? null : history.get(history.size() - 1);
        return new DailyCashEntryResponse(
            e.getId(),
            e.getStore().getId(),
            e.getBusinessDate(),
            e.getOpeningDrawerCash(),
            e.getCashExpenses(),
            e.getCashRemoved(),
            e.getCashRemaining(),
            e.getOtherAdjustments(),
            id(e.getEnteredByUser()),
            id(e.getEnteredBySuperAdmin()),
            name(e.getEnteredByUser(), e.getEnteredBySuperAdmin()),
            e.getEnteredAt(),
            id(e.getUpdatedByUser()),
            id(e.getUpdatedBySuperAdmin()),
            name(e.getUpdatedByUser(), e.getUpdatedBySuperAdmin()),
            e.getUpdatedAt(),
            history,
            latest == null ? null : latest.correctedByName(),
            latest == null ? null : latest.correctedAt());
    }
}
