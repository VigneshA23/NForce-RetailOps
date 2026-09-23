package com.nforce.retailops.repository;

import com.nforce.retailops.entity.MakeupLinkStatus;
import com.nforce.retailops.entity.TaskMakeupLink;
import com.nforce.retailops.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TaskMakeupLinkRepository extends JpaRepository<TaskMakeupLink, Long> {

    Optional<TaskMakeupLink> findByTaskIdAndStoreIdAndPastDateAndStatus(
        Long taskId, Long storeId, LocalDate pastDate, MakeupLinkStatus status
    );

    // Submission guard (TaskService.submitResponse / TaskMakeupLinkService.requireMoveTargeting):
    // PENDING or FULFILLED both count as "this instance was legitimately moved here" --
    // FULFILLED must be accepted too, not just PENDING, so a second MULTIPLE responder
    // (whose first teammate's submission already terminated the move) and a flag ->
    // resubmit cycle on an already-fulfilled moved unit can both still submit. A List,
    // not Optional: the instance could in principle have one terminal (FULFILLED) row
    // from an earlier move plus one live (PENDING) row from a later re-move -- the
    // caller matches on linkedDate to pick the one that's actually relevant.
    List<TaskMakeupLink> findByTaskIdAndStoreIdAndPastDateAndStatusIn(
        Long taskId, Long storeId, LocalDate pastDate, Collection<MakeupLinkStatus> statuses
    );

    // Batched form of the above, for building an entire missed-tasks page without one
    // query per candidate task.
    @Query("select l from TaskMakeupLink l where l.task.id in :taskIds and l.store.id = :storeId and l.status = :status")
    List<TaskMakeupLink> findByTaskIdInAndStoreIdAndStatus(
        @Param("taskIds") Collection<Long> taskIds, @Param("storeId") Long storeId, @Param("status") MakeupLinkStatus status
    );

    // Checklist read: every moved unit targeting one date for a store, in one query.
    // PENDING and FULFILLED are both included -- see TaskService.getTodayChecklistForEmployee
    // for why a FULFILLED row must still be considered (a moved unit's completed state,
    // and the second-responder case for MULTIPLE, both need it to still be findable).
    @Query("select l from TaskMakeupLink l join fetch l.task t join fetch t.category "
        + "where l.store.id = :storeId and l.linkedDate = :linkedDate and l.status in :statuses")
    List<TaskMakeupLink> findByStoreIdAndLinkedDateAndStatusIn(
        @Param("storeId") Long storeId, @Param("linkedDate") LocalDate linkedDate, @Param("statuses") Collection<MakeupLinkStatus> statuses
    );

    // Atomically terminates (PENDING -> FULFILLED) the pending move for an instance, if
    // any -- called unconditionally whenever an active response is created for
    // (taskId, storeId, pastDate) (TaskService.writeResponse). An UPDATE rather than
    // read-then-write, so two concurrent terminations for the same instance (e.g. both
    // MULTIPLE responders landing at once) are naturally race-safe with no explicit lock.
    // Deliberately NOT clearAutomatically: this runs mid-transaction inside
    // TaskService.writeResponse, which keeps using the just-saved TaskResponseEntry (and
    // its lazy associations, e.g. entry.getEmployee()) afterward -- clearing the whole
    // persistence context here would detach those and throw LazyInitializationException.
    // A caller that needs a fresh read of the row THIS bulk update touched should re-fetch
    // it explicitly rather than rely on any already-loaded TaskMakeupLink instance.
    @Modifying
    @Query("update TaskMakeupLink l set l.status = com.nforce.retailops.entity.MakeupLinkStatus.FULFILLED, "
        + "l.resolvedAt = :now, l.resolvedBy = :resolvedBy "
        + "where l.task.id = :taskId and l.store.id = :storeId and l.pastDate = :pastDate "
        + "and l.status = com.nforce.retailops.entity.MakeupLinkStatus.PENDING")
    int terminatePendingMove(
        @Param("taskId") Long taskId, @Param("storeId") Long storeId, @Param("pastDate") LocalDate pastDate,
        @Param("now") OffsetDateTime now, @Param("resolvedBy") User resolvedBy
    );

    // Lazy expiry: run before any link read/write (and by the nightly sweep) so a
    // PENDING move whose target day has already passed unfulfilled returns its
    // missed instance to the missed list instead of silently staying pending forever.
    // Deliberately NOT clearAutomatically -- see terminatePendingMove above; this is
    // also called at the top of read-only methods (e.g. getMissedTasks) that go on to
    // load other entities in the same transaction afterward.
    @Modifying
    @Query("update TaskMakeupLink l set l.status = com.nforce.retailops.entity.MakeupLinkStatus.EXPIRED, l.resolvedAt = :now "
        + "where l.status = com.nforce.retailops.entity.MakeupLinkStatus.PENDING and l.linkedDate < :today")
    int expireStalePending(@Param("today") LocalDate today, @Param("now") OffsetDateTime now);
}
