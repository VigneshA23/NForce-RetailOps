package com.nforce.retailops.repository;

import com.nforce.retailops.entity.MakeupLinkStatus;
import com.nforce.retailops.entity.TaskMakeupLink;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
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

    // Batched form of the above, for building an entire missed-tasks page without one
    // query per candidate task.
    @Query("select l from TaskMakeupLink l where l.task.id in :taskIds and l.store.id = :storeId and l.status = :status")
    List<TaskMakeupLink> findByTaskIdInAndStoreIdAndStatus(
        @Param("taskIds") Collection<Long> taskIds, @Param("storeId") Long storeId, @Param("status") MakeupLinkStatus status
    );

    // Fulfillment: locked so two employees completing today's instance at the same
    // moment can't both fulfil (and double-insert makeup responses for) the same
    // pending link -- runs inside the same transaction that just completed today's
    // instance (TaskMakeupLinkService.fulfillPendingLinksIfCompleted).
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from TaskMakeupLink l where l.task.id = :taskId and l.store.id = :storeId "
        + "and l.linkedDate = :linkedDate and l.status = com.nforce.retailops.entity.MakeupLinkStatus.PENDING")
    List<TaskMakeupLink> lockPendingForFulfillment(
        @Param("taskId") Long taskId, @Param("storeId") Long storeId, @Param("linkedDate") LocalDate linkedDate
    );

    // Lazy expiry: run before any link read/write (and by the nightly sweep) so a
    // PENDING link whose target day has already passed unfulfilled returns its
    // missed instance to the missed list instead of silently staying "Linked to today".
    @Modifying
    @Query("update TaskMakeupLink l set l.status = com.nforce.retailops.entity.MakeupLinkStatus.EXPIRED, l.resolvedAt = :now "
        + "where l.status = com.nforce.retailops.entity.MakeupLinkStatus.PENDING and l.linkedDate < :today")
    int expireStalePending(@Param("today") LocalDate today, @Param("now") OffsetDateTime now);
}
