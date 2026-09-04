package com.nforce.retailops.service;

import com.nforce.retailops.dto.ChecklistHistoryDetailResponse;
import com.nforce.retailops.dto.ChecklistHistoryOperationsReportResponse;
import com.nforce.retailops.dto.ChecklistHistorySummaryRow;
import com.nforce.retailops.dto.ChecklistHistoryTaskDetailRow;
import com.nforce.retailops.dto.HistoryCategoryResponse;
import com.nforce.retailops.dto.HistoryResponseEntryResponse;
import com.nforce.retailops.dto.HistoryTaskItemResponse;
import com.nforce.retailops.entity.ResponseType;
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
        List<StoreDayContext> contexts = buildStoreDayContexts(ownerId, requestedStoreIds, startDate, endDate);

        List<ChecklistHistorySummaryRow> rows = contexts.stream().map(this::toSummaryRow).collect(Collectors.toList());
        rows.sort(Comparator.comparing(ChecklistHistorySummaryRow::storeName)
            .thenComparing(ChecklistHistorySummaryRow::date));
        return rows;
    }

    // Daily Operations Summary report: same aggregation as getSummary (same
    // eligible-tasks-union-responded-tasks reconstruction, same Issue definition),
    // plus flattened task-level rows for CSV export / Print. Deliberately takes no
    // storeIds from the caller -- always resolves to the authenticated owner's own
    // authorized store(s), so an Admin can never request another store's data.
    @Transactional(readOnly = true)
    public ChecklistHistoryOperationsReportResponse getOperationsReport(
        Long ownerId, LocalDate startDate, LocalDate endDate
    ) {
        List<StoreDayContext> contexts = buildStoreDayContexts(ownerId, null, startDate, endDate);

        List<ChecklistHistorySummaryRow> summary = contexts.stream().map(this::toSummaryRow).collect(Collectors.toList());
        summary.sort(Comparator.comparing(ChecklistHistorySummaryRow::storeName)
            .thenComparing(ChecklistHistorySummaryRow::date));

        List<ChecklistHistoryTaskDetailRow> details = new ArrayList<>();
        for (StoreDayContext context : contexts) {
            for (Task task : context.unionTasksById().values()) {
                List<TaskResponseEntry> responses = context.responsesByTask().getOrDefault(task.getId(), List.of());
                if (responses.isEmpty()) {
                    details.add(new ChecklistHistoryTaskDetailRow(
                        context.store().getId(), context.store().getName(), context.date(),
                        task.getCategory().getName(), task.getName(), "NOT_COMPLETED", null, null, null
                    ));
                } else {
                    for (TaskResponseEntry response : responses) {
                        boolean isIssue = response.getResponseType() == ResponseType.YES_NO
                            && Boolean.FALSE.equals(response.getValueBoolean());
                        details.add(new ChecklistHistoryTaskDetailRow(
                            context.store().getId(), context.store().getName(), context.date(),
                            task.getCategory().getName(), task.getName(), isIssue ? "ISSUE" : "COMPLETED",
                            formatResponseValue(response), response.getEmployee().getFullName(), response.getCreatedAt()
                        ));
                    }
                }
            }
        }
        details.sort(Comparator.comparing(ChecklistHistoryTaskDetailRow::storeName)
            .thenComparing(ChecklistHistoryTaskDetailRow::date)
            .thenComparing(ChecklistHistoryTaskDetailRow::taskName));

        return new ChecklistHistoryOperationsReportResponse(summary, details);
    }

    private ChecklistHistorySummaryRow toSummaryRow(StoreDayContext context) {
        return new ChecklistHistorySummaryRow(
            context.store().getId(), context.store().getName(), context.date(),
            !context.unionTaskIds().isEmpty(), context.unionTaskIds().size(),
            context.respondedTaskIds().size(), context.issueCount()
        );
    }

    private String formatResponseValue(TaskResponseEntry response) {
        if (response.getValueBoolean() != null) {
            if (response.getResponseType() == ResponseType.YES_NO) {
                return response.getValueBoolean() ? "Yes" : "No";
            }
            return response.getValueBoolean() ? "Done" : "Not done";
        }
        if (response.getValueNumeric() != null) {
            return String.valueOf(response.getValueNumeric());
        }
        if (response.getValueText() != null && !response.getValueText().isEmpty()) {
            return response.getValueText();
        }
        return "";
    }

    // One entry per (store, date) in the requested range: the union of eligible and
    // responded tasks for that store/day, plus enough data (Task objects, grouped
    // responses) for both the summary counts and the task-level detail rows to be
    // derived from it without re-querying.
    private record StoreDayContext(
        Store store,
        LocalDate date,
        Set<Long> unionTaskIds,
        // Best-effort resolved Task objects for unionTaskIds -- used only to build
        // task-level detail rows (category/name). Summary counts always come from
        // unionTaskIds/respondedTaskIds directly, never from this map's size, so an
        // unresolved task id (should not happen in practice) can never under-count
        // the existing Scheduled/Completed totals.
        Map<Long, Task> unionTasksById,
        Set<Long> respondedTaskIds,
        Map<Long, List<TaskResponseEntry>> responsesByTask,
        int issueCount
    ) {
    }

    private List<StoreDayContext> buildStoreDayContexts(
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
        Map<Long, Task> candidateTasksById = candidateTasks.stream()
            .collect(Collectors.toMap(Task::getId, task -> task, (a, b) -> a));

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

        // Tasks with responses but deactivated/rescoped since (not in candidateTasks
        // at all) -- fetched once across every store/date so they still appear in the
        // union instead of silently disappearing (same rule as getDetail).
        Set<Long> allRespondedTaskIds = responsesByStore.values().stream()
            .flatMap(List::stream)
            .map(entry -> entry.getTask().getId())
            .collect(Collectors.toSet());
        Set<Long> missingTaskIds = allRespondedTaskIds.stream()
            .filter(id -> !candidateTasksById.containsKey(id))
            .collect(Collectors.toSet());
        Map<Long, Task> missingTasksById = missingTaskIds.isEmpty()
            ? Map.of()
            : taskRepository.findAllById(missingTaskIds).stream()
                .collect(Collectors.toMap(Task::getId, task -> task));

        List<StoreDayContext> contexts = new ArrayList<>();
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
                Map<Long, List<TaskResponseEntry>> responsesByTask = dayResponses.stream()
                    .collect(Collectors.groupingBy(entry -> entry.getTask().getId()));
                Set<Long> respondedTaskIds = responsesByTask.keySet();

                Set<Long> eligibleTaskIds = tasksForStore.stream()
                    .filter(task -> withinTaskDateRange(task, date) && TaskScheduleMatcher.matches(task, date))
                    .map(Task::getId)
                    .collect(Collectors.toSet());

                // Union, not eligible-only: a task deactivated/reconfigured after the fact
                // must never disappear from -- or under-count -- a day it actually has
                // responses for.
                Set<Long> unionTaskIds = new HashSet<>(eligibleTaskIds);
                unionTaskIds.addAll(respondedTaskIds);
                Map<Long, Task> unionTasksById = new LinkedHashMap<>();
                for (Long taskId : unionTaskIds) {
                    Task task = candidateTasksById.getOrDefault(taskId, missingTasksById.get(taskId));
                    if (task != null) {
                        unionTasksById.put(taskId, task);
                    }
                }

                // Same "latest response per task, per day" reduction as getDetail's
                // consumer (checklistHistoryOptions.taskStatus): only the most recent
                // answer for a task that day counts toward whether it's an Issue.
                Map<Long, TaskResponseEntry> latestResponseByTask = dayResponses.stream()
                    .collect(Collectors.toMap(
                        entry -> entry.getTask().getId(),
                        entry -> entry,
                        (a, b) -> a.getCreatedAt().isAfter(b.getCreatedAt()) ? a : b
                    ));
                long issueCount = latestResponseByTask.values().stream()
                    .filter(entry -> entry.getResponseType() == ResponseType.YES_NO && Boolean.FALSE.equals(entry.getValueBoolean()))
                    .count();

                contexts.add(new StoreDayContext(
                    store, date, unionTaskIds, unionTasksById, respondedTaskIds, responsesByTask, (int) issueCount
                ));
            }
        }
        return contexts;
    }

    @Transactional(readOnly = true)
    public ChecklistHistoryDetailResponse getDetailForSuperAdmin(Long storeId, LocalDate date) {
        StoreOwner storeOwner = storeOwnerRepository.findByStoreIdAndActiveTrue(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        return getDetail(storeOwner.getOwner().getId(), storeId, date);
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

        return new ChecklistHistoryDetailResponse(store.getId(), store.getName(), date, !allTasks.isEmpty(), categories, List.of());
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
            task.getScheduleType(),
            task.getNumericUnit(),
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
            return storeOwnerRepository.findByOwnerIdAndActiveTrue(ownerId)
                .map(so -> List.of(so.getStore()))
                .orElseGet(List::of);
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
