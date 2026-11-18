package com.nforce.retailops.service;

import com.nforce.retailops.dto.SuperAdminCashCorrectionRequest;
import com.nforce.retailops.dto.SuperAdminCashFlagRequest;
import com.nforce.retailops.dto.SuperAdminCashReviewResponse;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.entity.DailyCashEntryCorrection;
import com.nforce.retailops.entity.DailyCashEntryFlag;
import com.nforce.retailops.entity.DailyCashEntryFlagAction;
import com.nforce.retailops.entity.DailyCashEntryFlagHistory;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.CashEntryFlagException;
import com.nforce.retailops.exception.DailyCashEntryNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.DailyCashEntryCorrectionRepository;
import com.nforce.retailops.repository.DailyCashEntryFlagHistoryRepository;
import com.nforce.retailops.repository.DailyCashEntryFlagRepository;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
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

// Super Admin's one-store-at-a-time cash review. Separate from
// DailyCashEntryService (which is the entry form) and from
// CashCalculationService (which keeps the Owner/Admin expected-cash
// formula). The "expected cash on hand" shown here is the spec's running
// sum of (cash_remaining + other_adjustments) across days up to and
// including the chosen date, computed at the DB.
@Service
public class SuperAdminCashReviewService {

    private static final int MIN_FLAG_WORDS = 5;

    private final DailyCashEntryRepository entryRepository;
    private final DailyCashEntryCorrectionRepository correctionRepository;
    private final DailyCashEntryFlagRepository flagRepository;
    private final DailyCashEntryFlagHistoryRepository flagHistoryRepository;
    private final StoreRepository storeRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;
    private final SuperAdminRepository superAdminRepository;
    private final UserRepository userRepository;
    private final StoreCashTargetService cashTargetService;
    private final NotificationService notificationService;

    public SuperAdminCashReviewService(
        DailyCashEntryRepository entryRepository,
        DailyCashEntryCorrectionRepository correctionRepository,
        DailyCashEntryFlagRepository flagRepository,
        DailyCashEntryFlagHistoryRepository flagHistoryRepository,
        StoreRepository storeRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        SuperAdminRepository superAdminRepository,
        UserRepository userRepository,
        StoreCashTargetService cashTargetService,
        NotificationService notificationService
    ) {
        this.entryRepository = entryRepository;
        this.correctionRepository = correctionRepository;
        this.flagRepository = flagRepository;
        this.flagHistoryRepository = flagHistoryRepository;
        this.storeRepository = storeRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.superAdminRepository = superAdminRepository;
        this.userRepository = userRepository;
        this.cashTargetService = cashTargetService;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public SuperAdminCashReviewResponse get(Long storeId, LocalDate date) {
        Store store = requireStore(storeId);
        LocalDate effectiveDate = date != null ? date : LocalDate.now();
        BigDecimal target = cashTargetService.getTargetAmount(storeId);
        BigDecimal expected = expectedCashOnHand(storeId, effectiveDate);

        Optional<DailyCashEntry> entry = entryRepository.findByStoreIdAndBusinessDate(storeId, effectiveDate);
        if (entry.isEmpty()) {
            return SuperAdminCashReviewResponse.noEntry(
                store.getId(), store.getName(), String.valueOf(store.getStoreCode()),
                effectiveDate, target, expected);
        }
        return toResponse(store, entry.get(), target, expected, effectiveDate);
    }

    @Transactional
    public SuperAdminCashReviewResponse correct(
        Long superAdminId, Long storeId, Long entryId, SuperAdminCashCorrectionRequest request
    ) {
        Store store = requireStore(storeId);
        DailyCashEntry entry = requireEntryForStore(storeId, entryId);
        SuperAdmin superAdmin = superAdminRepository.getReferenceById(superAdminId);
        OffsetDateTime now = OffsetDateTime.now();

        // Snapshot the pre-change values, then overwrite the live row in
        // place; the correction trail is append-only, so nothing is lost.
        // The reason and new-value columns (V118) are populated by
        // recordCorrection once the entry holds its corrected values.
        DailyCashEntryCorrection correction =
            DailyCashEntryCorrection.snapshotOf(entry, null, superAdmin, now);

        entry.setOpeningDrawerCash(request.openingDrawerCash());
        entry.setCashExpenses(request.cashExpenses());
        entry.setCashRemoved(request.cashRemoved());
        entry.setCashRemaining(request.cashRemaining());
        entry.setOtherAdjustments(request.otherAdjustments());
        // A correction recomputes the day's expected cash; the running sum
        // then shifts automatically because sumExpectedCashOnHandUpTo reads
        // this stored column.
        entry.setDailyExpectedCash(request.cashRemaining().add(request.otherAdjustments()));
        entry.setUpdatedByUser(null);
        entry.setUpdatedBySuperAdmin(superAdmin);
        entry.setUpdatedAt(now);
        entry = entryRepository.save(entry);
        correction.recordCorrection(entry, request.reason().strip());
        correctionRepository.save(correction);

        // Correcting the entry resolves any open flag -- the issue has been
        // addressed. We record it in the flag history so the trail is complete.
        flagRepository.findFirstByEntryIdAndResolvedAtIsNull(entryId).ifPresent(flag -> {
            flag.setResolvedBySuperAdmin(superAdmin);
            flag.setResolvedAt(now);
            flag.setResolution("CORRECTED");
            flagRepository.save(flag);
            flagHistoryRepository.save(DailyCashEntryFlagHistory.of(
                flag, DailyCashEntryFlagAction.RESOLVED, flag.getComment(), null, null, superAdmin, now));
        });

        return get(storeId, entry.getBusinessDate());
    }

    @Transactional
    public SuperAdminCashReviewResponse raiseFlag(
        Long superAdminId, Long storeId, Long entryId, SuperAdminCashFlagRequest request
    ) {
        Store store = requireStore(storeId);
        DailyCashEntry entry = requireEntryForStore(storeId, entryId);
        String comment = requireComment(request.comment());

        // One open flag at a time: the index would refuse the insert, but the
        // explicit check gives the Super Admin a friendlier message.
        if (flagRepository.findFirstByEntryIdAndResolvedAtIsNull(entryId).isPresent()) {
            throw new CashEntryFlagException(
                "This entry is already flagged. Remove or resolve the current flag before raising a new one.");
        }

        // Spec: the flag must notify the employee who entered it. If the
        // entry wasn't entered by an employee, or that employee is no longer
        // assigned to this store, there is no one to notify and the Super
        // Admin should correct the entry directly instead.
        User notifiedEmployee = resolveNotifiableEmployee(entry, storeId);
        SuperAdmin superAdmin = superAdminRepository.getReferenceById(superAdminId);
        OffsetDateTime now = OffsetDateTime.now();

        DailyCashEntryFlag flag = new DailyCashEntryFlag();
        flag.setEntry(entry);
        flag.setComment(comment);
        flag.setNotifiedUser(notifiedEmployee);
        flag.setFlaggedBySuperAdmin(superAdmin);
        flag.setFlaggedAt(now);
        DailyCashEntryFlag saved = flagRepository.save(flag);
        flagHistoryRepository.save(DailyCashEntryFlagHistory.of(
            saved, DailyCashEntryFlagAction.RAISED, null, comment, null, superAdmin, now));

        notificationService.sendForStore(
            notifiedEmployee,
            "CASH_ENTRY_FLAGGED",
            "Cash entry flagged",
            "Your cash entry for " + entry.getBusinessDate() + " has been flagged by a Super Admin: " + comment,
            CashFlagService.linkFor(entry),
            entry.getStore());

        return get(storeId, entry.getBusinessDate());
    }

    @Transactional
    public SuperAdminCashReviewResponse editFlag(
        Long superAdminId, Long storeId, Long entryId, SuperAdminCashFlagRequest request
    ) {
        requireStore(storeId);
        DailyCashEntry entry = requireEntryForStore(storeId, entryId);
        String comment = requireComment(request.comment());

        DailyCashEntryFlag flag = flagRepository.findFirstByEntryIdAndResolvedAtIsNull(entryId)
            .orElseThrow(() -> new CashEntryFlagException("No open flag to edit on this entry."));
        if (flag.getComment().equals(comment)) {
            return get(storeId, entry.getBusinessDate()); // no-op
        }
        SuperAdmin superAdmin = superAdminRepository.getReferenceById(superAdminId);
        OffsetDateTime now = OffsetDateTime.now();
        String previous = flag.getComment();
        flag.setComment(comment);
        flag.setCommentUpdatedAt(now);
        flagRepository.save(flag);
        flagHistoryRepository.save(DailyCashEntryFlagHistory.of(
            flag, DailyCashEntryFlagAction.COMMENT_EDITED, previous, comment, null, superAdmin, now));
        return get(storeId, entry.getBusinessDate());
    }

    @Transactional
    public SuperAdminCashReviewResponse removeFlag(Long superAdminId, Long storeId, Long entryId) {
        requireStore(storeId);
        DailyCashEntry entry = requireEntryForStore(storeId, entryId);
        DailyCashEntryFlag flag = flagRepository.findFirstByEntryIdAndResolvedAtIsNull(entryId)
            .orElseThrow(() -> new CashEntryFlagException("No open flag on this entry to remove."));
        SuperAdmin superAdmin = superAdminRepository.getReferenceById(superAdminId);
        OffsetDateTime now = OffsetDateTime.now();
        flag.setResolvedBySuperAdmin(superAdmin);
        flag.setResolvedAt(now);
        flag.setResolution("REMOVED");
        flagRepository.save(flag);
        flagHistoryRepository.save(DailyCashEntryFlagHistory.of(
            flag, DailyCashEntryFlagAction.REMOVED, flag.getComment(), null, null, superAdmin, now));
        return get(storeId, entry.getBusinessDate());
    }

    // ---- helpers ----------------------------------------------------------

    private BigDecimal expectedCashOnHand(Long storeId, LocalDate asOf) {
        BigDecimal sum = entryRepository.sumExpectedCashOnHandUpTo(storeId, asOf);
        return sum == null ? BigDecimal.ZERO : sum;
    }

    private Store requireStore(Long storeId) {
        return storeRepository.findById(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
    }

    private DailyCashEntry requireEntryForStore(Long storeId, Long entryId) {
        DailyCashEntry entry = entryRepository.findById(entryId)
            .orElseThrow(() -> new DailyCashEntryNotFoundException("Cash entry not found"));
        if (!entry.getStore().getId().equals(storeId)) {
            // Don't leak the other store's existence -- 404 the mismatch.
            throw new DailyCashEntryNotFoundException("Cash entry not found");
        }
        return entry;
    }

    private String requireComment(String raw) {
        String trimmed = raw == null ? "" : raw.strip();
        if (trimmed.isEmpty()) {
            throw new CashEntryFlagException("A flag comment is required.");
        }
        int words = trimmed.split("\\s+").length;
        if (words < MIN_FLAG_WORDS) {
            throw new CashEntryFlagException(
                "Please give at least " + MIN_FLAG_WORDS + " words of context for the flag.");
        }
        return trimmed;
    }

    // Returns the employee who entered this entry when they are still
    // assigned to the store and active. Throws CashEntryFlagException
    // otherwise -- the spec says the Super Admin should correct the entry
    // directly rather than flag it in that case.
    private User resolveNotifiableEmployee(DailyCashEntry entry, Long storeId) {
        User enteredBy = entry.getEnteredByUser();
        if (enteredBy == null) {
            throw new CashEntryFlagException(
                "This entry was not made by an employee, so there is no one to notify. "
                + "Correct the entry directly instead.");
        }
        if (!enteredBy.isActive()) {
            throw new CashEntryFlagException(
                "The employee who entered this is no longer active. Correct the entry directly instead.");
        }
        if (!storeEmployeeRepository.existsByEmployeeIdAndStoresId(enteredBy.getId(), storeId)) {
            throw new CashEntryFlagException(
                "The employee who entered this is no longer assigned to this store. "
                + "Correct the entry directly instead.");
        }
        return enteredBy;
    }

    // ---- mapping ----------------------------------------------------------

    private SuperAdminCashReviewResponse toResponse(
        Store store, DailyCashEntry entry, BigDecimal target, BigDecimal expected, LocalDate date
    ) {
        List<DailyCashEntryCorrection> corrections = correctionRepository
            .findByEntryIdOrderByCorrectedAtAscIdAsc(entry.getId());
        Optional<DailyCashEntryFlag> openFlag = flagRepository.findFirstByEntryIdAndResolvedAtIsNull(entry.getId());

        String status = openFlag.isPresent() ? "Flagged"
            : !corrections.isEmpty() ? "Corrected"
            : "Entered";

        return new SuperAdminCashReviewResponse(
            store.getId(), store.getName(), String.valueOf(store.getStoreCode()), date,
            target, expected,
            new SuperAdminCashReviewResponse.Entry(
                entry.getId(),
                entry.getStore().getId(),
                entry.getBusinessDate(),
                entry.getOpeningDrawerCash(),
                entry.getCashExpenses(),
                entry.getCashRemoved(),
                entry.getCashRemaining(),
                entry.getOtherAdjustments(),
                actorOf(entry.getEnteredByUser(), entry.getEnteredBySuperAdmin()),
                entry.getEnteredAt(),
                actorOf(entry.getUpdatedByUser(), entry.getUpdatedBySuperAdmin()),
                entry.getUpdatedAt(),
                status),
            openFlag.map(flag -> new SuperAdminCashReviewResponse.Flag(
                flag.getId(),
                flag.getComment(),
                actorOf(flag.getFlaggedByUser(), flag.getFlaggedBySuperAdmin()),
                flag.getFlaggedAt(),
                flag.getCommentUpdatedAt())).orElse(null),
            corrections.stream().map(c -> new SuperAdminCashReviewResponse.CorrectionHistoryEntry(
                c.getId(),
                c.getPreviousOpeningDrawerCash(),
                c.getPreviousCashExpenses(),
                c.getPreviousCashRemoved(),
                c.getPreviousCashRemaining(),
                c.getPreviousOtherAdjustments(),
                actorOf(c.getCorrectedByUser(), c.getCorrectedBySuperAdmin()),
                c.getCorrectedAt(),
                c.getReason())).toList());
    }

    // Resolves a user+super-admin pair to a single Actor; both null means
    // nothing to show (returns null). Exactly one is expected to be non-null
    // on every real row.
    private SuperAdminCashReviewResponse.Actor actorOf(User user, SuperAdmin superAdmin) {
        if (user != null) {
            User u = userRepository.findById(user.getId()).orElse(user);
            return new SuperAdminCashReviewResponse.Actor(u.getId(), u.getFullName(), roleKindOf(u));
        }
        if (superAdmin != null) {
            SuperAdmin sa = superAdminRepository.findById(superAdmin.getId()).orElse(superAdmin);
            return new SuperAdminCashReviewResponse.Actor(sa.getId(), sa.getName(), "SUPER_ADMIN");
        }
        return null;
    }

    private String roleKindOf(User u) {
        for (Role r : u.getRoles()) {
            if ("OWNER_ADMIN".equals(r.getName())) return "OWNER_ADMIN";
        }
        return "EMPLOYEE";
    }
}
