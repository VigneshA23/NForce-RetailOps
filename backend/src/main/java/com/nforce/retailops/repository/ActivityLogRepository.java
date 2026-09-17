package com.nforce.retailops.repository;

import com.nforce.retailops.entity.ActivityLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {

    // Super Admin's platform-wide feed -- every row, newest first.
    List<ActivityLog> findAllByOrderByOccurredAtDesc(Pageable pageable);

    // Owner Admin's feed -- only activity for their own store(s). Platform-level
    // rows with a null storeId (e.g. a new admin account with no store yet) never
    // match an owner's storeIds list, so they're correctly excluded here.
    List<ActivityLog> findByStoreIdInOrderByOccurredAtDesc(Collection<Long> storeIds, Pageable pageable);

    // Super Admin's feed excludes TASK_COMPLETED -- that action type is
    // reserved for an Owner Admin's own task-activity feed below, and would
    // otherwise flood the platform-wide admin-action feed with routine
    // employee checklist submissions.
    List<ActivityLog> findByActionTypeNotOrderByOccurredAtDesc(String actionType, Pageable pageable);

    // Owner Admin's task-activity feed -- only TASK_COMPLETED rows for their
    // own store(s), newest first.
    List<ActivityLog> findByStoreIdInAndActionTypeOrderByOccurredAtDesc(
        Collection<Long> storeIds, String actionType, Pageable pageable);
}
