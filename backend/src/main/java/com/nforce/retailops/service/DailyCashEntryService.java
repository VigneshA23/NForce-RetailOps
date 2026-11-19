package com.nforce.retailops.service;

import com.nforce.retailops.dto.DailyCashEntryRequest;
import com.nforce.retailops.dto.DailyCashEntryResponse;
import com.nforce.retailops.dto.ExpectedCashRangeResponse;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.dto.ExpectedCashAsOfResponse;
import com.nforce.retailops.entity.DailyCashEntryCorrection;
import com.nforce.retailops.entity.DailyCashEntryFlag;
import com.nforce.retailops.entity.DailyCashEntryFlagAction;
import com.nforce.retailops.entity.DailyCashEntryFlagHistory;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.CashEntryAmountsRequiredException;
import com.nforce.retailops.exception.CorrectionReasonRequiredException;
import com.nforce.retailops.exception.DailyCashEntryNotEditableException;
import com.nforce.retailops.exception.DailyCashEntryNotFoundException;
import com.nforce.retailops.exception.InvalidDateRangeException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.DailyCashEntryCorrectionRepository;
import com.nforce.retailops.repository.DailyCashEntryFlagHistoryRepository;
import com.nforce.retailops.repository.DailyCashEntryFlagRepository;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

// Daily cash entry (opening drawer, cash removed, cash remaining, other adjustments). Owner/Admin writes to their own active store; an
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
    private final CashFlagService flagService;
    private final DailyCashEntryFlagRepository flagRepository;
    private final DailyCashEntryFlagHistoryRepository flagHistoryRepository;

    public DailyCashEntryService(
        DailyCashEntryRepository entryRepository,
        DailyCashEntryCorrectionRepository correctionRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        StoreRepository storeRepository,
        UserRepository userRepository,
        SuperAdminRepository superAdminRepository,
        CashFlagService flagService,
        DailyCashEntryFlagRepository flagRepository,
        DailyCashEntryFlagHistoryRepository flagHistoryRepository
    ) {
        this.entryRepository = entryRepository;
        this.correctionRepository = correctionRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.storeRepository = storeRepository;
        this.userRepository = userRepository;
        this.superAdminRepository = superAdminRepository;
        this.flagService = flagService;
        this.flagRepository = flagRepository;
        this.flagHistoryRepository = flagHistoryRepository;
    }

    // ---- Owner/Admin: own store -------------------------------------------

    @Transactional
    public DailyCashEntryResponse save(Long ownerId, DailyCashEntryRequest request) {
        Store store = requireActiveStoreOwner(ownerId).getStore();
        return saveEntry(store, userRepository.getReferenceById(ownerId), null, request, true, false);
    }

    @Transactional(readOnly = true)
    public DailyCashEntryResponse get(Long ownerId, LocalDate date) {
        return getEntry(requireActiveStoreOwner(ownerId).getStore().getId(), date);
    }

    @Transactional(readOnly = true)
    public ExpectedCashRangeResponse getRangeSum(Long ownerId, LocalDate from, LocalDate to) {
        Long storeId = requireActiveStoreOwner(ownerId).getStore().getId();
        return sumRange(storeId, from, to);
    }

    // Expected cash on hand as of a date (sum of daily expected cash from the
    // store's first entry up to and including it), whether or not that day has
    // an entry of its own.
    @Transactional(readOnly = true)
    public ExpectedCashAsOfResponse getExpectedAsOf(Long ownerId, LocalDate date) {
        Long storeId = requireActiveStoreOwner(ownerId).getStore().getId();
        return asOf(storeId, date);
    }

    @Transactional(readOnly = true)
    public ExpectedCashAsOfResponse getExpectedAsOfForSuperAdmin(Long storeId, LocalDate date) {
        if (!storeRepository.existsById(storeId)) {
            throw new StoreNotFoundException("Store not found");
        }
        return asOf(storeId, date);
    }

    private ExpectedCashAsOfResponse asOf(Long storeId, LocalDate date) {
        LocalDate day = date != null ? date : LocalDate.now();
        BigDecimal sum = entryRepository.sumExpectedCashOnHandUpTo(storeId, day);
        return new ExpectedCashAsOfResponse(storeId, day, sum == null ? BigDecimal.ZERO : sum);
    }

    // ---- Super Admin: any store, chosen explicitly ------------------------

    @Transactional
    public DailyCashEntryResponse saveForSuperAdmin(Long superAdminId, Long storeId, DailyCashEntryRequest request) {
        Store store = storeRepository.findById(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        return saveEntry(store, null, superAdminRepository.getReferenceById(superAdminId), request, false, false);
    }

    @Transactional(readOnly = true)
    public DailyCashEntryResponse getForSuperAdmin(Long storeId, LocalDate date) {
        Store store = storeRepository.findById(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        return getEntry(store.getId(), date);
    }

    // ---- Employee: any store they are assigned to, today only --------------

    // Any store employee may record today's entry or edit it while it is not
    // flagged (every edit lands in the audit trail with who and when, and no
    // reason is asked, only an optional note). Once an Owner/Admin or Super
    // Admin flags it, only the employee in entered_by may change it, on
    // whatever date it was flagged; everyone else gets a 403. Saving it clears
    // the flag ("Resolved") and records the fix in history.
    @Transactional
    public DailyCashEntryResponse saveForEmployee(Long employeeId, Long storeId, DailyCashEntryRequest request) {
        Store store = requireAssignedStore(employeeId, storeId);
        LocalDate date = request.businessDate() != null ? request.businessDate() : LocalDate.now();
        DailyCashEntry existing = entryRepository.findByStoreIdAndBusinessDate(store.getId(), date).orElse(null);
        boolean flagged = existing != null && flagService.openFlag(existing.getId()).isPresent();
        if (flagged) {
            if (!isEnteredBy(existing, employeeId)) {
                throw new DailyCashEntryNotEditableException(
                    "This entry was flagged for the employee who entered it. Only they can correct it.");
            }
        } else if (!date.equals(LocalDate.now())) {
            throw new DailyCashEntryNotEditableException("Employees can only record cash for today");
        }
        return saveEntry(store, userRepository.getReferenceById(employeeId), null, request, false, true)
            .forEmployee().withCanEdit(true);
    }

    @Transactional(readOnly = true)
    public DailyCashEntryResponse getForEmployee(Long employeeId, Long storeId, LocalDate date) {
        Long id = requireAssignedStore(employeeId, storeId).getId();
        LocalDate businessDate = date != null ? date : LocalDate.now();
        DailyCashEntry entry = entryRepository.findByStoreIdAndBusinessDate(id, businessDate)
            .orElseThrow(() -> new DailyCashEntryNotFoundException("No cash entry for " + businessDate));
        boolean flagged = flagService.openFlag(entry.getId()).isPresent();
        boolean editable = flagged ? isEnteredBy(entry, employeeId) : businessDate.equals(LocalDate.now());
        return toResponse(entry).forEmployee().withCanEdit(editable);
    }

    private static boolean isEnteredBy(DailyCashEntry entry, Long userId) {
        return entry.getEnteredByUser() != null && entry.getEnteredByUser().getId().equals(userId);
    }

    // Masked as "not found" when the store isn't one the employee works at.
    private Store requireAssignedStore(Long employeeId, Long storeId) {
        if (!storeEmployeeRepository.existsByEmployeeIdAndActiveStoreId(employeeId, storeId)) {
            throw new StoreNotFoundException("Store not found");
        }
        return storeRepository.findById(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
    }

    @Transactional(readOnly = true)
    public ExpectedCashRangeResponse getRangeSumForSuperAdmin(Long storeId, LocalDate from, LocalDate to) {
        if (!storeRepository.existsById(storeId)) {
            throw new StoreNotFoundException("Store not found");
        }
        return sumRange(storeId, from, to);
    }

    // ---- shared ------------------------------------------------------------

    // Exactly one of user / superAdmin is non-null.
    //
    // Amounts the request leaves null are not touched, so the opening drawer
    // cash and the other figures can be saved separately, and an admin can
    // change one figure without re-entering the rest. Filling in a figure that
    // was never recorded is not a correction (no reason, no audit row); only
    // overwriting a recorded figure with a different one is.
    private DailyCashEntryResponse saveEntry(
        Store store, User user, SuperAdmin superAdmin, DailyCashEntryRequest request, boolean reasonRequired,
        boolean byEmployee
    ) {
        if (!request.hasAnyAmount()) {
            throw new CashEntryAmountsRequiredException("Enter at least one cash amount to save");
        }
        CashActor actor = new CashActor(user, superAdmin);
        store = storeRepository.lockByStoreId(store.getId())
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        LocalDate date = request.businessDate() != null ? request.businessDate() : LocalDate.now();
        OffsetDateTime now = OffsetDateTime.now();
        DailyCashEntry entry = entryRepository
            .lockByStoreIdAndBusinessDate(store.getId(), date)
            .orElse(null);

        DailyCashEntryCorrection correction = null;
        String reason = null;
        boolean existed = entry != null;
        if (entry == null) {
            entry = new DailyCashEntry();
            entry.setStore(store);
            entry.setBusinessDate(date);
            entry.setOtherAdjustments(BigDecimal.ZERO);
            entry.setEnteredByUser(user);
            entry.setEnteredBySuperAdmin(superAdmin);
            entry.setEnteredAt(now);
        } else {
            reason = request.correctionReason() == null ? "" : request.correctionReason().trim();
            if (!changes(entry, request)) {
                // Nothing to correct, so no audit row. The entering employee
                // may still confirm a flagged entry as right.
                if (byEmployee) {
                    flagService.resolveOnCorrection(entry, actor, CashFlagService.RESOLUTION_EMPLOYEE_FIXED,
                        reason.isEmpty() ? null : reason, now);
                }
                return toResponse(entry);
            }
            if (overwrites(entry, request)) {
                if (reason.isEmpty() && reasonRequired) {
                    throw new CorrectionReasonRequiredException("A reason is required to correct this entry");
                }
                // Old values now; the new values and reason are added once applied.
                correction = DailyCashEntryCorrection.snapshotOf(entry, user, superAdmin, now);
            }
        }

        if (request.openingDrawerCash() != null) entry.setOpeningDrawerCash(request.openingDrawerCash());
        if (request.cashRemoved() != null) entry.setCashRemoved(request.cashRemoved());
        if (request.cashRemaining() != null) entry.setCashRemaining(request.cashRemaining());
        if (request.otherAdjustments() != null) entry.setOtherAdjustments(request.otherAdjustments());
        // Daily expected cash = cash remaining + other adjustments (signed);
        // see CashCalculationService. Persisted on the entry so the running sum
        // is a single-column SUM and the response can carry the saved figure.
        entry.setDailyExpectedCash(CashCalculationService.dailyExpected(
            entry.getCashRemaining(), entry.getOtherAdjustments()));
        entry.setUpdatedByUser(user);
        entry.setUpdatedBySuperAdmin(superAdmin);
        entry.setUpdatedAt(now);
        entry = entryRepository.save(entry);
        if (existed) {
            if (correction != null) {
                correction.recordCorrection(entry, reason.isEmpty() ? null : reason);
                correctionRepository.save(correction);
            }
            // Changing a flagged entry resolves its flag, whoever changes it.
            flagService.resolveOnCorrection(entry, actor,
                byEmployee ? CashFlagService.RESOLUTION_EMPLOYEE_FIXED : CashFlagService.RESOLUTION_CORRECTED,
                reason.isEmpty() ? null : reason, now);
        }
        return toResponse(entry);
    }

    // Does the request give any amount a different value from what is saved
    // (a figure never recorded counts as different)?
    private static boolean changes(DailyCashEntry e, DailyCashEntryRequest r) {
        return differs(e.getOpeningDrawerCash(), r.openingDrawerCash(), false)
            || differs(e.getCashRemoved(), r.cashRemoved(), false)
            || differs(e.getCashRemaining(), r.cashRemaining(), false)
            || differs(e.getOtherAdjustments(), r.otherAdjustments(), false);
    }

    // Does it replace a figure that was already recorded? Other adjustments
    // always has a stored value (0 by default), but a 0 nobody typed is not a
    // recorded figure, so only a non-zero one counts.
    private static boolean overwrites(DailyCashEntry e, DailyCashEntryRequest r) {
        return differs(e.getOpeningDrawerCash(), r.openingDrawerCash(), true)
            || differs(e.getCashRemoved(), r.cashRemoved(), true)
            || differs(e.getCashRemaining(), r.cashRemaining(), true)
            || (r.otherAdjustments() != null && e.getOtherAdjustments().signum() != 0
                && e.getOtherAdjustments().compareTo(r.otherAdjustments()) != 0);
    }

    private static boolean differs(BigDecimal saved, BigDecimal given, boolean savedMustExist) {
        if (given == null) return false;
        if (saved == null) return !savedMustExist;
        return saved.compareTo(given) != 0;
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

    private ExpectedCashRangeResponse sumRange(Long storeId, LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new InvalidDateRangeException("Both 'from' and 'to' dates are required");
        }
        if (to.isBefore(from)) {
            throw new InvalidDateRangeException("'to' date cannot be before 'from' date");
        }
        BigDecimal sum = entryRepository.sumExpectedCashOnHandBetween(storeId, from, to);
        return new ExpectedCashRangeResponse(storeId, from, to, sum == null ? BigDecimal.ZERO : sum);
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
                c.getPreviousCashRemoved(),
                c.getPreviousCashRemaining(),
                c.getPreviousOtherAdjustments(),
                c.getPreviousDailyExpectedCash(),
                id(c.getPreviousUpdatedByUser()),
                id(c.getPreviousUpdatedBySuperAdmin()),
                c.getPreviousUpdatedAt(),
                id(c.getCorrectedByUser()),
                id(c.getCorrectedBySuperAdmin()),
                c.getCorrectedAt(),
                name(c.getCorrectedByUser(), c.getCorrectedBySuperAdmin()),
                c.getReason(),
                c.getNewOpeningDrawerCash(),
                c.getNewCashRemoved(),
                c.getNewCashRemaining(),
                c.getNewOtherAdjustments()))
            .toList();
        DailyCashEntryResponse.Correction latest = history.isEmpty() ? null : history.get(history.size() - 1);
        List<DailyCashEntryCorrection> corrections = correctionRepository
            .findByEntryIdOrderByCorrectedAtAscIdAsc(e.getId());
        DailyCashEntryCorrection latestCorrection =
            corrections.isEmpty() ? null : corrections.get(corrections.size() - 1);
        Optional<DailyCashEntryFlag> openFlag = flagService.openFlag(e.getId());
        BigDecimal expectedOnHand = entryRepository.sumExpectedCashOnHandUpTo(
            e.getStore().getId(), e.getBusinessDate());
        return new DailyCashEntryResponse(
            e.getId(),
            e.getStore().getId(),
            e.getBusinessDate(),
            e.getOpeningDrawerCash(),
            e.getCashRemoved(),
            e.getCashRemaining(),
            e.getOtherAdjustments(),
            e.getDailyExpectedCash(),
            expectedOnHand == null ? BigDecimal.ZERO : expectedOnHand,
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
            latest == null ? null : latest.correctedAt(),
            latestCorrection == null ? null : roleOf(latestCorrection.getCorrectedByUser(),
                latestCorrection.getCorrectedBySuperAdmin()),
            openFlag.isPresent() ? "Flagged" : history.isEmpty() ? "Entered" : "Corrected",
            openFlag.map(this::flagDto).orElse(null),
            openFlag.isPresent() ? null : lastResolvedFlag(e.getId()),
            null);
    }

    private DailyCashEntryResponse.Flag lastResolvedFlag(Long entryId) {
        List<DailyCashEntryFlag> flags = flagRepository.findByEntryIdInOrderByFlaggedAtAscIdAsc(java.util.Collections.singletonList(entryId));
        if (flags.isEmpty()) return null;
        return flagDto(flags.get(flags.size() - 1));
    }

    private DailyCashEntryResponse.Flag flagDto(DailyCashEntryFlag f) {
        String note = null;
        if (f.getResolvedAt() != null && CashFlagService.RESOLUTION_EMPLOYEE_FIXED.equals(f.getResolution())) {
            note = flagHistoryRepository.findByEntryIdOrderByRecordedAtAscIdAsc(f.getEntry().getId()).stream()
                .filter(h -> h.getFlag() != null && h.getFlag().getId().equals(f.getId())
                    && h.getAction() == DailyCashEntryFlagAction.RESOLVED)
                .map(DailyCashEntryFlagHistory::getNewComment)
                .filter(c -> c != null)
                .findFirst().orElse(null);
        }
        return new DailyCashEntryResponse.Flag(
            f.getId(), f.getComment(),
            name(f.getFlaggedByUser(), f.getFlaggedBySuperAdmin()),
            roleOf(f.getFlaggedByUser(), f.getFlaggedBySuperAdmin()),
            f.getFlaggedAt(), f.getCommentUpdatedAt(),
            name(f.getResolvedByUser(), f.getResolvedBySuperAdmin()),
            f.getResolvedAt(), f.getResolution(), note);
    }

    // OWNER_ADMIN / SUPER_ADMIN / EMPLOYEE.
    static String roleOf(User user, SuperAdmin superAdmin) {
        if (superAdmin != null) return "SUPER_ADMIN";
        if (user == null) return null;
        for (Role r : user.getRoles()) {
            if ("OWNER_ADMIN".equals(r.getName())) return "OWNER_ADMIN";
        }
        return "EMPLOYEE";
    }
}
