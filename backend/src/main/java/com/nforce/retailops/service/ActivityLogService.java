package com.nforce.retailops.service;

import com.nforce.retailops.dto.ActivityLogEntryResponse;
import com.nforce.retailops.entity.ActivityLog;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.repository.ActivityLogRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Collection;
import java.util.List;

// Writes and reads "Recent Activity" entries. Super Admin's feed shows
// Owner-Admin and Employee activity platform-wide (tasks/issues/corrections
// done by owners, issues reported by employees) -- genuine oversight of what
// other roles are doing -- but excludes TASK_COMPLETED (reserved for an
// Owner Admin's own feed below; would otherwise drown this one in routine
// checklist submissions) and SUPER_ADMIN-authored rows (Super Admin has no
// need to watch their own actions played back to them, and those rows all
// share the literal actor name "Super Admin" regardless of account, so they
// carry no real audit value). An Owner Admin's feed is the inverse: only
// TASK_COMPLETED rows for their own store(s), since they already see their
// own admin actions reflected in the UI they just used, and staff task
// activity is the signal not shown anywhere else on their dashboard.
// Deliberately no @Async/queue here -- write volume is low enough at the
// "2-store scale" this app targets that a synchronous save alongside the
// triggering action is simplest.
@Service
public class ActivityLogService {

    public static final String TASK_COMPLETED = "TASK_COMPLETED";

    private final ActivityLogRepository activityLogRepository;
    private final StoreOwnerRepository storeOwnerRepository;

    public ActivityLogService(ActivityLogRepository activityLogRepository, StoreOwnerRepository storeOwnerRepository) {
        this.activityLogRepository = activityLogRepository;
        this.storeOwnerRepository = storeOwnerRepository;
    }

    @Transactional
    public void log(
        String actionType, String actorName, String actorRole,
        Long storeId, String storeName,
        String entityType, String entityName, String description
    ) {
        ActivityLog entry = new ActivityLog();
        entry.setActionType(actionType);
        entry.setActorName(actorName);
        entry.setActorRole(actorRole);
        entry.setStoreId(storeId);
        entry.setStoreName(storeName);
        entry.setEntityType(entityType);
        entry.setEntityName(entityName);
        entry.setDescription(description);
        activityLogRepository.save(entry);
    }

    // Platform-level event with no single store (e.g. an admin account created
    // before any store is assigned) -- visible only in Super Admin's feed.
    @Transactional
    public void logPlatform(String actionType, String actorName, String actorRole, String entityType, String entityName, String description) {
        log(actionType, actorName, actorRole, null, null, entityType, entityName, description);
    }

    // One row per affected store, so the event shows up in every one of those
    // stores' owners' own feeds, not just Super Admin's. Falls back to a single
    // platform-level row if the action genuinely affects no specific store.
    @Transactional
    public void logForStores(
        String actionType, String actorName, String actorRole,
        Collection<Store> stores, String entityType, String entityName, String description
    ) {
        if (stores.isEmpty()) {
            logPlatform(actionType, actorName, actorRole, entityType, entityName, description);
            return;
        }
        for (Store store : stores) {
            log(actionType, actorName, actorRole, store.getId(), store.getName(), entityType, entityName, description);
        }
    }

    @Transactional(readOnly = true)
    public List<ActivityLogEntryResponse> getRecentForPlatform(int limit) {
        return getRecentForPlatform(limit, null, null);
    }

    // startDate/endDate null -> unfiltered, most-recent-first (unchanged
    // behaviour for the Home dashboard's activity widget). Both supplied ->
    // scoped to that inclusive local-calendar-day window, for the Recent
    // Activity "view all" page's date filter.
    @Transactional(readOnly = true)
    public List<ActivityLogEntryResponse> getRecentForPlatform(int limit, LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null) {
            return activityLogRepository
                .findByActionTypeNotAndActorRoleNotOrderByOccurredAtDesc(TASK_COMPLETED, "SUPER_ADMIN", PageRequest.of(0, limit)).stream()
                .map(ActivityLogEntryResponse::from)
                .toList();
        }
        return activityLogRepository
            .findByActionTypeNotAndActorRoleNotAndOccurredAtGreaterThanEqualAndOccurredAtLessThanOrderByOccurredAtDesc(
                TASK_COMPLETED, "SUPER_ADMIN", rangeStart(startDate), rangeEndExclusive(endDate), PageRequest.of(0, limit))
            .stream()
            .map(ActivityLogEntryResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<ActivityLogEntryResponse> getRecentForOwner(Long ownerId, int limit) {
        return getRecentForOwner(ownerId, limit, null, null);
    }

    @Transactional(readOnly = true)
    public List<ActivityLogEntryResponse> getRecentForOwner(Long ownerId, int limit, LocalDate startDate, LocalDate endDate) {
        List<Long> storeIds = storeOwnerRepository.findByOwnerId(ownerId).stream()
            .filter(StoreOwner::isActive)
            .map(so -> so.getStore().getId())
            .toList();
        if (storeIds.isEmpty()) {
            return List.of();
        }
        if (startDate == null || endDate == null) {
            return activityLogRepository
                .findByStoreIdInAndActionTypeOrderByOccurredAtDesc(storeIds, TASK_COMPLETED, PageRequest.of(0, limit)).stream()
                .map(ActivityLogEntryResponse::from)
                .toList();
        }
        return activityLogRepository
            .findByStoreIdInAndActionTypeAndOccurredAtGreaterThanEqualAndOccurredAtLessThanOrderByOccurredAtDesc(
                storeIds, TASK_COMPLETED, rangeStart(startDate), rangeEndExclusive(endDate), PageRequest.of(0, limit))
            .stream()
            .map(ActivityLogEntryResponse::from)
            .toList();
    }

    private static OffsetDateTime rangeStart(LocalDate date) {
        return date.atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
    }

    private static OffsetDateTime rangeEndExclusive(LocalDate date) {
        return date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
    }
}
