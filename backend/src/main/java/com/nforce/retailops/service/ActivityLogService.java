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

import java.util.Collection;
import java.util.List;

// Writes and reads "Recent Activity" entries. Super Admin's feed shows every
// admin-action row platform-wide (categories/employees/tasks/issues/
// corrections/owners) but excludes TASK_COMPLETED -- routine employee
// checklist submissions would otherwise drown that feed out, and Super Admin
// has no other visibility into per-action admin activity across stores. An
// Owner Admin's feed is the inverse: only TASK_COMPLETED rows for their own
// store(s), since they already see their own admin actions reflected in the
// UI they just used, and staff task activity is the signal not shown anywhere
// else on their dashboard. Deliberately no @Async/queue here -- write volume
// is low enough at the "2-store scale" this app targets that a synchronous
// save alongside the triggering action is simplest.
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
        return activityLogRepository.findByActionTypeNotOrderByOccurredAtDesc(TASK_COMPLETED, PageRequest.of(0, limit)).stream()
            .map(ActivityLogEntryResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<ActivityLogEntryResponse> getRecentForOwner(Long ownerId, int limit) {
        List<Long> storeIds = storeOwnerRepository.findByOwnerId(ownerId).stream()
            .filter(StoreOwner::isActive)
            .map(so -> so.getStore().getId())
            .toList();
        if (storeIds.isEmpty()) {
            return List.of();
        }
        return activityLogRepository
            .findByStoreIdInAndActionTypeOrderByOccurredAtDesc(storeIds, TASK_COMPLETED, PageRequest.of(0, limit)).stream()
            .map(ActivityLogEntryResponse::from)
            .toList();
    }
}
