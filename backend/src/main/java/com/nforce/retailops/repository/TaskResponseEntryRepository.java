package com.nforce.retailops.repository;

import com.nforce.retailops.entity.TaskResponseEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TaskResponseEntryRepository extends JpaRepository<TaskResponseEntry, Long> {

    List<TaskResponseEntry> findByTaskIdAndStoreIdAndResponseDateAndActiveTrue(
        Long taskId, Long storeId, LocalDate responseDate
    );

    // Batched form of the above, for building an entire day's checklist without one
    // query per task.
    List<TaskResponseEntry> findByTaskIdInAndStoreIdAndResponseDateAndActiveTrue(
        Collection<Long> taskIds, Long storeId, LocalDate responseDate
    );

    Optional<TaskResponseEntry> findByIdAndTaskIdAndStoreId(Long id, Long taskId, Long storeId);

    // Admin checklist-history summary: one query for an entire store-range request,
    // rather than one query per store per day.
    List<TaskResponseEntry> findByStoreIdInAndResponseDateBetweenAndActiveTrue(
        Collection<Long> storeIds, LocalDate startDate, LocalDate endDate
    );

    // Admin checklist-history detail: deliberately broader than
    // findByTaskIdInAndStoreIdAndResponseDateAndActiveTrue -- no task_id predicate, so it
    // also surfaces responses for tasks that are no longer eligible under the current
    // task configuration (deactivated, rescoped, etc.), which the union-based
    // reconstruction in ChecklistHistoryService relies on to never drop real history.
    List<TaskResponseEntry> findByStoreIdAndResponseDateAndActiveTrue(Long storeId, LocalDate responseDate);

    // Backs the deleteTask history guard. Deliberately has no "active" predicate --
    // an undone (active=false) response is still a historical fact that must block
    // deletion, per TaskResponseEntry's own preserve-history contract.
    boolean existsByTaskId(Long taskId);
}
