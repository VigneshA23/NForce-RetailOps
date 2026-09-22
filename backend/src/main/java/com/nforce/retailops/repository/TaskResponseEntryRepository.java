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

    // Chain-continuation lookup for submitResponse: after an employee undoes their
    // own response (active=false, no supersededResponseId set on anything -- Undo
    // itself never links forward), this finds that same employee's most recent row
    // for this task/store/day, active or not, so the NEXT submission can link back to
    // it via supersededResponseId. Without this, an undo-then-resubmit cycle drops the
    // undone value from history entirely (unlike flag->resubmit or a live MULTIPLE
    // resubmission, both of which already preserve the chain).
    Optional<TaskResponseEntry> findFirstByTaskIdAndStoreIdAndResponseDateAndEmployeeIdOrderByCreatedAtDesc(
        Long taskId, Long storeId, LocalDate responseDate, Long employeeId
    );

    // Admin checklist-history summary: one query for an entire store-range request,
    // rather than one query per store per day. join fetch all three associations so
    // accessing .getStore()/.getTask()/.getEmployee() on results never fires lazy-load
    // queries (N+1) -- all @ManyToOne, no collection bags, so multiple join fetches are safe.
    @Query("select tre from TaskResponseEntry tre "
        + "join fetch tre.task join fetch tre.store join fetch tre.employee "
        + "where tre.store.id in :storeIds "
        + "and tre.responseDate between :startDate and :endDate "
        + "and tre.active = true")
    List<TaskResponseEntry> findByStoreIdInAndResponseDateBetweenAndActiveTrue(
        @Param("storeIds") Collection<Long> storeIds,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    // Batched, date-range form of findByStoreIdAndResponseDateAndActiveFalseAndUndoneByUserTrue
    // -- lets the Daily Operations Report (ChecklistHistoryService.buildStoreDayContexts)
    // surface a task an employee answered and then explicitly Undid, with no resubmission
    // since, the same way Employee/Owner/Super Admin History already does, instead of it
    // showing as if nothing happened.
    @Query("select tre from TaskResponseEntry tre "
        + "join fetch tre.task join fetch tre.store join fetch tre.employee "
        + "where tre.store.id in :storeIds "
        + "and tre.responseDate between :startDate and :endDate "
        + "and tre.active = false and tre.undoneByUser = true")
    List<TaskResponseEntry> findByStoreIdInAndResponseDateBetweenAndActiveFalseAndUndoneByUserTrue(
        @Param("storeIds") Collection<Long> storeIds,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    // Admin checklist-history detail: deliberately broader than
    // findByTaskIdInAndStoreIdAndResponseDateAndActiveTrue -- no task_id predicate, so it
    // also surfaces responses for tasks that are no longer eligible under the current
    // task configuration (deactivated, rescoped, etc.), which the union-based
    // reconstruction in ChecklistHistoryService relies on to never drop real history.
    // Owner-facing only: intentionally includes every employee's responses.
    // join fetch task and employee: callers access .getTask().getId() and
    // .getEmployee().getFullName()/.getId()/.getAvatarUrl() on each result.
    @Query("select tre from TaskResponseEntry tre "
        + "join fetch tre.task join fetch tre.employee "
        + "where tre.store.id = :storeId "
        + "and tre.responseDate = :responseDate "
        + "and tre.active = true")
    List<TaskResponseEntry> findByStoreIdAndResponseDateAndActiveTrue(
        @Param("storeId") Long storeId,
        @Param("responseDate") LocalDate responseDate
    );

    // Employee-facing history detail: the employee-scoped analogue of
    // findByStoreIdAndResponseDateAndActiveTrue above -- adds an employeeId
    // predicate so MeHistoryService only ever loads (and can only ever return)
    // the calling employee's own responses for that store/day, never a
    // teammate's. Same "no task_id predicate" reasoning applies, so a
    // deactivated/rescoped task the employee personally answered still surfaces.
    List<TaskResponseEntry> findByStoreIdAndResponseDateAndEmployeeIdAndActiveTrue(
        Long storeId, LocalDate responseDate, Long employeeId
    );

    // History detail (Employee, Owner/Admin, Super Admin): a task an employee
    // answered and then explicitly Undid, with no resubmission since, has zero
    // active responses -- this surfaces that dangling row so the day's history
    // still shows "who undid it and when" instead of the whole event vanishing.
    // undoneByUser = true excludes rows deactivated purely because a fresh
    // resubmission superseded them (those are already covered by the active
    // successor's resubmission-history chain).
    @Query("select tre from TaskResponseEntry tre join fetch tre.employee "
        + "where tre.store.id = :storeId and tre.responseDate = :responseDate "
        + "and tre.active = false and tre.undoneByUser = true")
    List<TaskResponseEntry> findByStoreIdAndResponseDateAndActiveFalseAndUndoneByUserTrue(
        @Param("storeId") Long storeId, @Param("responseDate") LocalDate responseDate
    );

    // Missed-tasks scan: every active response for a set of candidate tasks across the
    // whole 90-day lookback window, in one round trip -- lets TaskMakeupLinkService
    // determine per (task, date) whether the instance is already satisfied
    // (CompletionType.isSatisfiedBy) without one query per candidate day.
    @Query("select tre from TaskResponseEntry tre join fetch tre.employee "
        + "where tre.task.id in :taskIds and tre.store.id = :storeId "
        + "and tre.responseDate between :startDate and :endDate and tre.active = true")
    List<TaskResponseEntry> findByTaskIdInAndStoreIdAndResponseDateBetweenAndActiveTrue(
        @Param("taskIds") Collection<Long> taskIds, @Param("storeId") Long storeId,
        @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate
    );

    // Backs the deleteTask history guard. Deliberately has no "active" predicate --
    // an undone (active=false) response is still a historical fact that must block
    // deletion, per TaskResponseEntry's own preserve-history contract.
    boolean existsByTaskId(Long taskId);

    // Backs the deleteStore history guard -- any response against a store (active
    // or undone) is enough to block deletion, same rationale as existsByTaskId.
    boolean existsByStoreId(Long storeId);

    // Latest submission timestamp for a store on a given date — used by
    // SuperAdminOperationsService to populate lastActivityAt per store.
    @Query("SELECT MAX(tre.createdAt) FROM TaskResponseEntry tre "
        + "WHERE tre.store.id = :storeId AND tre.responseDate = :responseDate AND tre.active = true")
    java.time.OffsetDateTime findMaxCreatedAtByStoreIdAndResponseDate(
        @Param("storeId") Long storeId, @Param("responseDate") java.time.LocalDate responseDate
    );

    // Returns (responseDate, storeId, taskId) tuples for trend computation — one
    // round trip for the entire date range instead of one query per store per day.
    @Query("SELECT tre.responseDate, tre.store.id, tre.task.id FROM TaskResponseEntry tre "
        + "WHERE tre.store.id IN :storeIds AND tre.responseDate BETWEEN :startDate AND :endDate AND tre.active = true")
    List<Object[]> findDateStoreTaskIdTuples(
        @Param("storeIds") Collection<Long> storeIds,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );
}
