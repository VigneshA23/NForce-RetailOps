package com.nforce.retailops.service;

import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.repository.RaisedIssueRepository;
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
 * Both methods are package-visible (non-private) so the test class can call
 * them directly without relying on the actual cron schedule.
 */
@Service
public class SuperAdminAlertService {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminAlertService.class);

    private final StoreRepository storeRepository;
    private final TaskResponseEntryRepository taskResponseEntryRepository;
    private final RaisedIssueRepository raisedIssueRepository;
    private final SuperAdminRepository superAdminRepository;
    private final NotificationService notificationService;

    public SuperAdminAlertService(
        StoreRepository storeRepository,
        TaskResponseEntryRepository taskResponseEntryRepository,
        RaisedIssueRepository raisedIssueRepository,
        SuperAdminRepository superAdminRepository,
        NotificationService notificationService
    ) {
        this.storeRepository = storeRepository;
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
            null,
            null
        );
    }
}
