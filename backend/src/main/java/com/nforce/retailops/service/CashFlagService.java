package com.nforce.retailops.service;

import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.entity.DailyCashEntryFlag;
import com.nforce.retailops.entity.DailyCashEntryFlagAction;
import com.nforce.retailops.entity.DailyCashEntryFlagHistory;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.CashEntryFlagException;
import com.nforce.retailops.repository.DailyCashEntryFlagHistoryRepository;
import com.nforce.retailops.repository.DailyCashEntryFlagRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;

// The flag lifecycle on a cash entry, shared by Owner/Admin and Super Admin
// (who raise, edit and remove flags) and by the entry-saving paths (which
// resolve an open flag when the entry is corrected). Callers have already
// checked the actor may touch this store. Every change is appended to
// daily_cash_entry_flag_history and never edited afterwards.
@Service
public class CashFlagService {

    public static final String RESOLUTION_REMOVED = "REMOVED";
    public static final String RESOLUTION_CORRECTED = "CORRECTED";
    public static final String RESOLUTION_EMPLOYEE_FIXED = "EMPLOYEE_FIXED";

    private final DailyCashEntryFlagRepository flagRepository;
    private final DailyCashEntryFlagHistoryRepository historyRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;
    private final NotificationService notificationService;

    public CashFlagService(
        DailyCashEntryFlagRepository flagRepository,
        DailyCashEntryFlagHistoryRepository historyRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        NotificationService notificationService
    ) {
        this.flagRepository = flagRepository;
        this.historyRepository = historyRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.notificationService = notificationService;
    }

    // The notification's linkPath: the Daily Cash page on the flagged date.
    public static String linkFor(DailyCashEntry entry) {
        return "/cash?date=" + entry.getBusinessDate();
    }

    @Transactional(readOnly = true)
    public Optional<DailyCashEntryFlag> openFlag(Long entryId) {
        return flagRepository.findFirstByEntryIdAndResolvedAtIsNull(entryId);
    }

    @Transactional
    public DailyCashEntryFlag raise(DailyCashEntry entry, CashActor actor, String rawComment) {
        String comment = requireComment(rawComment);
        if (openFlag(entry.getId()).isPresent()) {
            throw new CashEntryFlagException(
                "This entry is already flagged. Edit or remove the current flag, or wait for it to be resolved.");
        }
        User employee = requireNotifiableEmployee(entry);
        OffsetDateTime now = OffsetDateTime.now();

        DailyCashEntryFlag flag = new DailyCashEntryFlag();
        flag.setEntry(entry);
        flag.setComment(comment);
        flag.setNotifiedUser(employee);
        flag.setFlaggedByUser(actor.user());
        flag.setFlaggedBySuperAdmin(actor.superAdmin());
        flag.setFlaggedAt(now);
        flag = flagRepository.save(flag);
        historyRepository.save(DailyCashEntryFlagHistory.of(
            flag, DailyCashEntryFlagAction.RAISED, null, comment, actor.user(), actor.superAdmin(), now));

        // One notification, to the employee who entered it and nobody else.
        notificationService.sendForStore(
            employee, "CASH_ENTRY_FLAGGED", "Cash entry flagged",
            "Your cash entry for " + entry.getBusinessDate() + " was flagged by " + actor.displayName() + ": " + comment,
            linkFor(entry), entry.getStore());
        return flag;
    }

    @Transactional
    public DailyCashEntryFlag editComment(DailyCashEntry entry, CashActor actor, String rawComment) {
        String comment = requireComment(rawComment);
        DailyCashEntryFlag flag = openFlag(entry.getId())
            .orElseThrow(() -> new CashEntryFlagException("There is no open flag on this entry to edit."));
        if (flag.getComment().equals(comment)) return flag;
        OffsetDateTime now = OffsetDateTime.now();
        String previous = flag.getComment();
        flag.setComment(comment);
        flag.setCommentUpdatedAt(now);
        flag = flagRepository.save(flag);
        historyRepository.save(DailyCashEntryFlagHistory.of(
            flag, DailyCashEntryFlagAction.COMMENT_EDITED, previous, comment,
            actor.user(), actor.superAdmin(), now));
        return flag;
    }

    @Transactional
    public void remove(DailyCashEntry entry, CashActor actor) {
        DailyCashEntryFlag flag = openFlag(entry.getId())
            .orElseThrow(() -> new CashEntryFlagException("There is no open flag on this entry to remove."));
        close(flag, actor, RESOLUTION_REMOVED, DailyCashEntryFlagAction.REMOVED, flag.getComment(), null,
            OffsetDateTime.now());
    }

    // Called when the entry's figures are corrected: closes the open flag (if
    // any) as resolved, by an admin ("CORRECTED") or by the entering employee
    // ("EMPLOYEE_FIXED", with their optional note).
    @Transactional
    public void resolveOnCorrection(DailyCashEntry entry, CashActor actor, String resolution, String note,
                                    OffsetDateTime now) {
        openFlag(entry.getId()).ifPresent(flag ->
            close(flag, actor, resolution, DailyCashEntryFlagAction.RESOLVED, flag.getComment(), note, now));
    }

    private void close(DailyCashEntryFlag flag, CashActor actor, String resolution,
                       DailyCashEntryFlagAction action, String previous, String next, OffsetDateTime now) {
        flag.setResolvedByUser(actor.user());
        flag.setResolvedBySuperAdmin(actor.superAdmin());
        flag.setResolvedAt(now);
        flag.setResolution(resolution);
        flagRepository.save(flag);
        historyRepository.save(DailyCashEntryFlagHistory.of(
            flag, action, previous, next, actor.user(), actor.superAdmin(), now));
    }

    static String requireComment(String raw) {
        String trimmed = raw == null ? "" : raw.strip();
        if (trimmed.isEmpty()) {
            throw new CashEntryFlagException("A flag comment is required.");
        }
        return trimmed;
    }

    // Only the employee in entered_by is told, so an entry with no known
    // employee, or one whose employee has left the store, cannot be flagged.
    private User requireNotifiableEmployee(DailyCashEntry entry) {
        User enteredBy = entry.getEnteredByUser();
        if (enteredBy == null || !isEmployee(enteredBy)) {
            throw new CashEntryFlagException(
                "This entry was not entered by a known employee, so there is no one to notify. "
                + "Correct the entry directly instead.");
        }
        if (!enteredBy.isActive()) {
            throw new CashEntryFlagException(
                "The employee who entered this is no longer active. Correct the entry directly instead.");
        }
        if (!storeEmployeeRepository.existsByEmployeeIdAndActiveStoreId(
                enteredBy.getId(), entry.getStore().getId())) {
            throw new CashEntryFlagException(
                "The employee who entered this is no longer assigned to this store. "
                + "Correct the entry directly instead.");
        }
        return enteredBy;
    }

    // An Owner/Admin who saved the entry (entered_by is a user too) has no one
    // to "fix" it, so only employees are valid recipients.
    private static boolean isEmployee(User user) {
        return user.getRoles().stream().anyMatch(role -> "EMPLOYEE".equals(role.getName()));
    }
}
