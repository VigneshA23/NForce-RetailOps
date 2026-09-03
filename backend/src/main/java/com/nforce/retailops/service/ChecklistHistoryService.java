package com.nforce.retailops.service;

import com.nforce.retailops.dto.ChecklistHistoryDetailResponse;
import com.nforce.retailops.dto.ChecklistHistorySummaryRow;
import com.nforce.retailops.dto.HistoryCategoryResponse;
import com.nforce.retailops.dto.HistoryResponseEntryResponse;
import com.nforce.retailops.dto.HistoryTaskItemResponse;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.exception.InvalidDateRangeException;
import com.nforce.retailops.exception.InvalidStoreSelectionException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Owner/Admin-facing read model over historical checklist data. Deliberately
 * separate from TaskService: a different aggregate (multi-store, arbitrary
 * date range) with no CRUD semantics, and no "canUndo" concept since this is
 * a read-only audit view, not the employee's own in-progress checklist.
 */
@Service
public class ChecklistHistoryService {

    // Generous ceiling for a compliance/audit review ("2-store scale" per CLAUDE.md).
    private static final int MAX_DATE_RANGE_DAYS = 92;
    private static final int MAX_STORE_SELECTION = 50;

    private final TaskRepository taskRepository;
    private final TaskResponseEntryRepository taskResponseEntryRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;

    public ChecklistHistoryService(
        TaskRepository taskRepository,
        TaskResponseEntryRepository taskResponseEntryRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreEmployeeRepository storeEmployeeRepository
    ) {
        this.taskRepository = taskRepository;
        this.taskResponseEntryRepository = taskResponseEntryRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
    }

    @Transactional(readOnly = true)
    public List<ChecklistHistorySummaryRow> getSummary(
        Long ownerId, List<Long> requestedStoreIds, LocalDate startDate, LocalDate endDate
    ) {
        LocalDate resolvedStart = startDate != null ? startDate : LocalDate.now();
        LocalDate resolvedEnd = endDate != null ? endDate : LocalDate.now();
        validateRange(resolvedStart, resolvedEnd);

        List<Store> stores = resolveStores(ownerId, requestedStoreIds);
        List<LocalDate> dates = datesBetween(resolvedStart, resolvedEnd);

        List<Long> storeIds = stores.stream().map(Store::getId).toList();
        Map<Long, List<TaskResponseEntry>> responsesByStore = storeIds.isEmpty()
            ? Map.of()
            : taskResponseEntryRepository
                .findByStoreIdInAndResponseDateBetweenAndActiveTrue(storeIds, resolvedStart, resolvedEnd).stream()
                .collect(Collectors.groupingBy(entry -> entry.getStore().getId()));

        // Fetched once across ALL requested stores (not once per store): a task's own
        // config rarely changes day-to-day, so only per-store/per-day schedule/date-range
        // eligibility needs to be re-evaluated below, in memory.
        List<Task> candidateTasks = storeIds.isEmpty()
            ? List.of()
            : taskRepository.findActiveForStoresAndDateRange(ownerId, storeIds, resolvedStart, resolvedEnd);

        // Batched form of Task.stores, so per-store eligibility for scoped (non-
        // appliesToAllStores) tasks can be reconstructed without a lazy-load per task.
        List<Long> scopedTaskIds = candidateTasks.stream()
            .filter(task -> !task.isAppliesToAllStores())
            .map(Task::getId)
            .toList();
        Map<Long, Set<Long>> storeIdsByTaskId = scopedTaskIds.isEmpty()
            ? Map.of()
            : taskRepository.findStoreRowsGroupedByTaskIds(scopedTaskIds).stream()
                .collect(Collectors.groupingBy(
                    row -> (Long) row[0],
                    Collectors.mapping(row -> (Long) row[1], Collectors.toSet())
                ));

        List<ChecklistHistorySummaryRow> rows = new ArrayList<>();
        for (Store store : stores) {
            List<Task> tasksForStore = candidateTasks.stream()
                .filter(task -> task.isAppliesToAllStores()
                    || storeIdsByTaskId.getOrDefault(task.getId(), Set.of()).contains(store.getId()))
                .toList();
            Map<LocalDate, List<TaskResponseEntry>> responsesByDate = responsesByStore
                .getOrDefault(store.getId(), List.of()).stream()
                .collect(Collectors.groupingBy(TaskResponseEntry::getResponseDate));

            for (LocalDate date : dates) {
                List<TaskResponseEntry> dayResponses = responsesByDate.getOrDefault(date, List.of());
                Set<Long> respondedTaskIds = dayResponses.stream()
                    .map(entry -> entry.getTask().getId())
                    .collect(Collectors.toSet());

                Set<Long> eligibleTaskIds = tasksForStore.stream()
                    .filter(task -> withinTaskDateRange(task, date) && TaskScheduleMatcher.matches(task, date))
                    .map(Task::getId)
                    .collect(Collectors.toSet());

                // Union, not eligible-only: a task deactivated/reconfigured after the fact
                // must never disappear from -- or under-count -- a day it actually has
                // responses for.
                Set<Long> unionTaskIds = new HashSet<>(eligibleTaskIds);
                unionTaskIds.addAll(respondedTaskIds);

                rows.add(new ChecklistHistorySummaryRow(
                    store.getId(), store.getName(), date,
                    !unionTaskIds.isEmpty(), unionTaskIds.size(), respondedTaskIds.size()
                ));
            }
        }

        rows.sort(Comparator.comparing(ChecklistHistorySummaryRow::storeName)
            .thenComparing(ChecklistHistorySummaryRow::date));
        return rows;
    }

    @Transactional(readOnly = true)
    public ChecklistHistoryDetailResponse getDetail(Long ownerId, Long storeId, LocalDate date) {
        StoreOwner storeOwner = storeOwnerRepository.findByStoreIdAndOwnerId(storeId, ownerId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        Store store = storeOwner.getStore();

        List<Task> eligibleTasks = taskRepository.findActiveForStoreAndDate(ownerId, storeId, date).stream()
            .filter(task -> TaskScheduleMatcher.matches(task, date))
            .toList();

        List<TaskResponseEntry> responses = taskResponseEntryRepository
            .findByStoreIdAndResponseDateAndActiveTrue(storeId, date);
        Map<Long, List<TaskResponseEntry>> responsesByTask = responses.stream()
            .collect(Collectors.groupingBy(entry -> entry.getTask().getId()));

        Set<Long> eligibleTaskIds = eligibleTasks.stream().map(Task::getId).collect(Collectors.toSet());
        Set<Long> missingTaskIds = responsesByTask.keySet().stream()
            .filter(id -> !eligibleTaskIds.contains(id))
            .collect(Collectors.toSet());

        List<Task> allTasks = new ArrayList<>(eligibleTasks);
        if (!missingTaskIds.isEmpty()) {
            // Tasks with real responses that no longer show up under the current
            // config (deactivated, rescoped away, schedule changed) -- fetched by id
            // so their historical responses are never silently dropped from the view.
            allTasks.addAll(taskRepository.findAllById(missingTaskIds));
        }
        allTasks.sort(Comparator
            .comparing((Task task) -> task.getCategory().getDisplayOrder())
            .thenComparing(Task::getDisplayOrder)
            .thenComparing(Task::getId));

        List<Long> employeeUserIds = responses.stream()
            .map(entry -> entry.getEmployee().getId())
            .distinct()
            .toList();
        Map<Long, String> empIdByUserId = employeeUserIds.isEmpty()
            ? Map.of()
            : storeEmployeeRepository.findByEmployeeIdIn(employeeUserIds).stream()
                .collect(Collectors.toMap(
                    storeEmployee -> storeEmployee.getEmployee().getId(),
                    storeEmployee -> "EMP-" + String.format("%03d", storeEmployee.getId())
                ));

        LinkedHashMap<Long, List<Task>> tasksByCategory = new LinkedHashMap<>();
        for (Task task : allTasks) {
            tasksByCategory.computeIfAbsent(task.getCategory().getId(), key -> new ArrayList<>()).add(task);
        }

        List<HistoryCategoryResponse> categories = tasksByCategory.values().stream()
            .map(tasks -> new HistoryCategoryResponse(
                tasks.get(0).getCategory().getId(),
                tasks.get(0).getCategory().getName(),
                tasks.stream()
                    .map(task -> toHistoryTaskItem(task, responsesByTask.getOrDefault(task.getId(), List.of()), empIdByUserId))
                    .toList()
            ))
            .toList();

        return new ChecklistHistoryDetailResponse(store.getId(), store.getName(), date, !allTasks.isEmpty(), categories);
    }

    private HistoryTaskItemResponse toHistoryTaskItem(
        Task task, List<TaskResponseEntry> responses, Map<Long, String> empIdByUserId
    ) {
        List<HistoryResponseEntryResponse> responseDtos = responses.stream()
            .map(entry -> new HistoryResponseEntryResponse(
                entry.getId(),
                entry.getEmployee().getId(),
                entry.getEmployee().getFullName(),
                empIdByUserId.get(entry.getEmployee().getId()),
                entry.getValueBoolean(),
                entry.getValueNumeric(),
                entry.getValueText(),
                entry.getCreatedAt()
            ))
            .toList();

        return new HistoryTaskItemResponse(
            task.getId(),
            task.getName(),
            task.getDescription(),
            task.getResponseType(),
            task.getCompletionType(),
            !responseDtos.isEmpty(),
            task.isActive(),
            responseDtos
        );
    }

    private boolean withinTaskDateRange(Task task, LocalDate date) {
        return !date.isBefore(task.getStartDate()) && (task.getEndDate() == null || !date.isAfter(task.getEndDate()));
    }

    private void validateRange(LocalDate startDate, LocalDate endDate) {
        if (startDate.isAfter(endDate)) {
            throw new InvalidDateRangeException("Start date must be on or before end date");
        }
        long spanDays = ChronoUnit.DAYS.between(startDate, endDate) + 1;
        if (spanDays > MAX_DATE_RANGE_DAYS) {
            throw new InvalidDateRangeException("Date range cannot exceed " + MAX_DATE_RANGE_DAYS + " days");
        }
    }

    private List<LocalDate> datesBetween(LocalDate startDate, LocalDate endDate) {
        List<LocalDate> dates = new ArrayList<>();
        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            dates.add(date);
        }
        return dates;
    }

    private List<Store> resolveStores(Long ownerId, List<Long> requestedStoreIds) {
        if (requestedStoreIds == null || requestedStoreIds.isEmpty()) {
            return storeOwnerRepository.findByOwnerId(ownerId).stream().map(StoreOwner::getStore).toList();
        }
        if (requestedStoreIds.size() > MAX_STORE_SELECTION) {
            throw new InvalidStoreSelectionException("Select at most " + MAX_STORE_SELECTION + " stores");
        }

        List<StoreOwner> owned = storeOwnerRepository.findByOwnerIdAndStoreIdIn(ownerId, requestedStoreIds);
        if (owned.size() != Set.copyOf(requestedStoreIds).size()) {
            throw new InvalidStoreSelectionException("One or more selected stores could not be found");
        }
        return owned.stream().map(StoreOwner::getStore).toList();
    }
}
