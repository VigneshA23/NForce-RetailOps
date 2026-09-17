package com.nforce.retailops.service;

import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.repository.RaisedIssueRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Daily scheduled alerts fired to all Super Admin accounts.
 *
 * Trigger 1 — STORE_ZERO_ACTIVITY (20:00 daily):
 *   Any active store that has received no task responses today gets one alert
 *   per SA per day.  Guards against repeated alerting via a dedup_key.
 *
 * Trigger 2 — ISSUES_OVERDUE (09:00 daily):
 *   Any store whose OPEN issues are older than 48 hours gets one aggregated
 *   alert per SA per day (count included in the message).
 *
 * Trigger 3 — STORE_OWNER_VACANT (hourly):
 *   Any store whose StoreOwner link has been ownerless (owner deactivated, or
 *   their access to this store revoked -- see OwnerManagementService) for at
 *   least 24 hours gets one alert per SA, deduped per vacancy occurrence (the
 *   dedup key includes the vacancy's start timestamp) rather than per day, so
 *   a still-unresolved case is never re-notified on the next hourly run.
 *
 * All methods are package-visible (non-private) so the test class can call
 * them directly without relying on the actual cron schedule.
 */
@Service
public class SuperAdminAlertService {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminAlertService.class);
    private static final long OWNER_VACANCY_NOTIFY_AFTER_HOURS = 24;

    private final StoreRepository storeRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final TaskResponseEntryRepository taskResponseEntryRepository;
    private final RaisedIssueRepository raisedIssueRepository;
    private final SuperAdminRepository superAdminRepository;
    private final NotificationService notificationService;

    public SuperAdminAlertService(
        StoreRepository storeRepository,
        StoreOwnerRepository storeOwnerRepository,
        TaskResponseEntryRepository taskResponseEntryRepository,
        RaisedIssueRepository raisedIssueRepository,
        SuperAdminRepository superAdminRepository,
        NotificationService notificationService
    ) {
        this.storeRepository = storeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.taskResponseEntryRepository = taskResponseEntryRepository;
        this.raisedIssueRepository = raisedIssueRepository;
        this.superAdminRepository = superAdminRepository;
        this.notificationService = notificationService;
    }

    /**
     * Trigger 1 — scheduled at 20:00 server time every day.
     * For each active store, if totalResponses == 0 today, fires one
     * STORE_ZERO_ACTIVITY notification to every SA (dedup-guarded per SA per day).
     */
    @Scheduled(cron = "0 0 20 * * ?")
    @Transactional
    public void runZeroActivityCheck() {
        runZeroActivityCheck(LocalDate.now());
    }

    /** Same logic — accepts an explicit date so tests can call it without waiting for cron. */
    @Transactional
    public void runZeroActivityCheck(LocalDate date) {
        List<Store> activeStores = storeRepository.findAll().stream()
            .filter(Store::isActive)
            .toList();
        List<SuperAdmin> superAdmins = superAdminRepository.findAll();
        if (superAdmins.isEmpty()) return;

        for (Store store : activeStores) {
            boolean hasActivity = !taskResponseEntryRepository
                .findByStoreIdAndResponseDateAndActiveTrue(store.getId(), date)
                .isEmpty();
            if (hasActivity) continue;

            String dedupKey = "STORE_ZERO_ACTIVITY:" + store.getId() + ":" + date;
            for (SuperAdmin sa : superAdmins) {
                if (notificationService.superAdminNotificationExists(sa.getId(), dedupKey)) continue;
                notificationService.sendToSuperAdmin(
                    sa,
                    "STORE_ZERO_ACTIVITY",
                    store.getName() + " — no activity today",
                    "No task responses have been recorded at " + store.getName() + " for " + date + ".",
                    "/checklist",
                    dedupKey
                );
            }
        }
        log.info("Zero-activity check complete for date={}", date);
    }

    /**
     * Trigger 2 — scheduled at 09:00 server time every day.
     * For each store with OPEN issues older than 48 hours, fires ONE aggregated
     * ISSUES_OVERDUE notification per SA per day (dedup-guarded).
     */
    @Scheduled(cron = "0 0 9 * * ?")
    @Transactional
    public void runOverdueIssuesCheck() {
        runOverdueIssuesCheck(OffsetDateTime.now());
    }

    /** Same logic — accepts an explicit cutoff so tests can call it without waiting for cron. */
    @Transactional
    public void runOverdueIssuesCheck(OffsetDateTime now) {
        OffsetDateTime cutoff = now.minusHours(48);
        LocalDate today = now.toLocalDate();

        List<Store> allStores = storeRepository.findAll();
        List<SuperAdmin> superAdmins = superAdminRepository.findAll();
        if (superAdmins.isEmpty()) return;

        for (Store store : allStores) {
            long overdueCount = raisedIssueRepository
                .countByStoreIdAndStatusAndCreatedAtBefore(store.getId(), "OPEN", cutoff);
            if (overdueCount == 0) continue;

            String dedupKey = "ISSUES_OVERDUE:" + store.getId() + ":" + today;
            for (SuperAdmin sa : superAdmins) {
                if (notificationService.superAdminNotificationExists(sa.getId(), dedupKey)) continue;
                String title = store.getName() + " — " + overdueCount + " overdue issue" + (overdueCount == 1 ? "" : "s");
                String message = store.getName() + " has " + overdueCount + " issue"
                    + (overdueCount == 1 ? "" : "s") + " open for more than 48 hours.";
                notificationService.sendToSuperAdmin(sa, "ISSUES_OVERDUE", title, message, "/checklist", dedupKey);
            }
        }
        log.info("Overdue-issues check complete for cutoff={}", cutoff);
    }

    /**
     * Fires OWNER_EMAIL_FAILED to the given SA — called from OwnerManagementService
     * when Resend returns an error during owner provisioning.
     * The account is kept; the temporary password shown in the creation dialog
     * can be shared with the new owner manually.
     */
    @Transactional
    public void notifyOwnerEmailDeliveryFailed(SuperAdmin sa, String ownerName) {
        if (sa == null) return;
        notificationService.sendToSuperAdmin(
            sa,
            "OWNER_EMAIL_FAILED",
            "Owner account email delivery failed",
            "Temporary password could not be emailed to " + ownerName
                + ". The account was created — share the temporary password with them manually.",
            "/owners",
            null
        );
    }

    /**
     * Trigger 3 — scheduled hourly.
     * Any store still ownerless 24+ hours after OwnerManagementService stamped
     * StoreOwner.ownerVacantSince fires one STORE_OWNER_VACANT alert per SA.
     * Resolving the vacancy (same or new Owner/Admin assigned/reactivated for
     * that store) clears ownerVacantSince, which both stops future alerts and
     * -- since the dedup key is scoped to that vacancy's start timestamp --
     * lets a later, separate vacancy on the same store notify again.
     */
    @Scheduled(cron = "0 0 * * * ?")
    @Transactional
    public void runOwnerVacancyCheck() {
        runOwnerVacancyCheck(OffsetDateTime.now());
    }

    /** Same logic — accepts an explicit "now" so tests can call it without waiting for cron. */
    @Transactional
    public void runOwnerVacancyCheck(OffsetDateTime now) {
        OffsetDateTime cutoff = now.minusHours(OWNER_VACANCY_NOTIFY_AFTER_HOURS);
        List<SuperAdmin> superAdmins = superAdminRepository.findAll();
        if (superAdmins.isEmpty()) return;

        List<StoreOwner> pendingVacancies = storeOwnerRepository.findAllWithOwnerVacancyPending().stream()
            .filter(so -> !so.getOwnerVacantSince().isAfter(cutoff))
            .toList();

        for (StoreOwner storeOwner : pendingVacancies) {
            Store store = storeOwner.getStore();
            String dedupKey = "STORE_OWNER_VACANT:" + store.getId() + ":" + storeOwner.getOwnerVacantSince();
            for (SuperAdmin sa : superAdmins) {
                if (notificationService.superAdminNotificationExists(sa.getId(), dedupKey)) continue;
                notificationService.sendToSuperAdmin(
                    sa,
                    "STORE_OWNER_VACANT",
                    store.getName() + " has no active Owner/Admin",
                    store.getName() + " has had no active Owner/Admin for over 24 hours. Assign an Owner/Admin to restore full access.",
                    "/owners",
                    dedupKey
                );
            }
        }
        log.info("Owner-vacancy check complete for cutoff={}", cutoff);
    }
}
