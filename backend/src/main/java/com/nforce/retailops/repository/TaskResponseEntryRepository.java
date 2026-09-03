package com.nforce.retailops.repository;

import com.nforce.retailops.entity.TaskResponseEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TaskResponseEntryRepository extends JpaRepository<TaskResponseEntry, Long> {

    // join fetch tre.employee: every caller reads entry.getEmployee().getFullName()/
    // isActive() while building the checklist response, so fetch it up front instead
    // of one lazy-load query per distinct employee.
    @Query("select tre from TaskResponseEntry tre join fetch tre.employee "
        + "where tre.task.id = :taskId and tre.store.id = :storeId "
        + "and tre.responseDate = :responseDate and tre.active = true")
    List<TaskResponseEntry> findByTaskIdAndStoreIdAndResponseDateAndActiveTrue(
        @Param("taskId") Long taskId, @Param("storeId") Long storeId, @Param("responseDate") LocalDate responseDate
    );

    // Batched form of the above, for building an entire day's checklist without one
    // query per task.
    @Query("select tre from TaskResponseEntry tre join fetch tre.employee "
        + "where tre.task.id in :taskIds and tre.store.id = :storeId "
        + "and tre.responseDate = :responseDate and tre.active = true")
    List<TaskResponseEntry> findByTaskIdInAndStoreIdAndResponseDateAndActiveTrue(
        @Param("taskIds") Collection<Long> taskIds, @Param("storeId") Long storeId, @Param("responseDate") LocalDate responseDate
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
    // Owner-facing only: intentionally includes every employee's responses.
    List<TaskResponseEntry> findByStoreIdAndResponseDateAndActiveTrue(Long storeId, LocalDate responseDate);

    // Employee-facing history detail: the employee-scoped analogue of
    // findByStoreIdAndResponseDateAndActiveTrue above -- adds an employeeId
    // predicate so MeHistoryService only ever loads (and can only ever return)
    // the calling employee's own responses for that store/day, never a
    // teammate's. Same "no task_id predicate" reasoning applies, so a
    // deactivated/rescoped task the employee personally answered still surfaces.
    List<TaskResponseEntry> findByStoreIdAndResponseDateAndEmployeeIdAndActiveTrue(
        Long storeId, LocalDate responseDate, Long employeeId
    );

    // Backs the deleteTask history guard. Deliberately has no "active" predicate --
    // an undone (active=false) response is still a historical fact that must block
    // deletion, per TaskResponseEntry's own preserve-history contract.
    boolean existsByTaskId(Long taskId);
}
