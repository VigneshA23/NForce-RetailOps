package com.nforce.retailops.service;

import com.nforce.retailops.dto.AdminCorrectionEntry;
import com.nforce.retailops.dto.ChecklistHistoryDetailResponse;
import com.nforce.retailops.dto.ChecklistHistoryOperationsReportResponse;
import com.nforce.retailops.dto.ChecklistHistorySummaryRow;
import com.nforce.retailops.dto.ChecklistHistoryTaskDetailRow;
import com.nforce.retailops.dto.HistoryCategoryResponse;
import com.nforce.retailops.dto.HistoryIssueResponse;
import com.nforce.retailops.dto.HistoryResponseEntryResponse;
import com.nforce.retailops.dto.HistoryTaskItemResponse;
import com.nforce.retailops.dto.ResponseHistoryEntry;
import com.nforce.retailops.entity.AdminCorrection;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.exception.InvalidDateRangeException;
import com.nforce.retailops.exception.InvalidStoreSelectionException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.AdminCorrectionRepository;
import com.nforce.retailops.repository.RaisedIssueRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

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
    private final AdminCorrectionRepository adminCorrectionRepository;
    private final RaisedIssueRepository raisedIssueRepository;

    public ChecklistHistoryService(
        TaskRepository taskRepository,
        TaskResponseEntryRepository taskResponseEntryRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        AdminCorrectionRepository adminCorrectionRepository,
        RaisedIssueRepository raisedIssueRepository
    ) {
        this.taskRepository = taskRepository;
        this.taskResponseEntryRepository = taskResponseEntryRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.adminCorrectionRepository = adminCorrectionRepository;
        this.raisedIssueRepository = raisedIssueRepository;
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
    // authorized store(s), so an Admin can never request another store's data. Super
    // Admin callers (no "own stores") use getOperationsReportForSuperAdmin below.
    @Transactional(readOnly = true)
    public ChecklistHistoryOperationsReportResponse getOperationsReport(
        Long ownerId, LocalDate startDate, LocalDate endDate
    ) {
        List<StoreDayContext> contexts = buildStoreDayContexts(ownerId, null, startDate, endDate);
        return buildOperationsReportResponse(contexts);
    }

    // Super Admin can export any store's operations summary by looking up the store's
    // actual owner, then reusing the owner's own resolution/aggregation -- mirrors
    // getDetailForSuperAdmin below.
    @Transactional(readOnly = true)
    public ChecklistHistoryOperationsReportResponse getOperationsReportForSuperAdmin(
        Long storeId, LocalDate startDate, LocalDate endDate
    ) {
        if (storeId == null) {
            throw new StoreNotFoundException("Store not found");
        }
        StoreOwner storeOwner = storeOwnerRepository.findByStoreIdAndActiveTrue(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        List<StoreDayContext> contexts = buildStoreDayContexts(
            storeOwner.getOwner().getId(), List.of(storeId), startDate, endDate);
        return buildOperationsReportResponse(contexts);
    }

    private ChecklistHistoryOperationsReportResponse buildOperationsReportResponse(List<StoreDayContext> contexts) {
        List<ChecklistHistorySummaryRow> summary = contexts.stream().map(this::toSummaryRow).collect(Collectors.toList());
        summary.sort(Comparator.comparing(ChecklistHistorySummaryRow::storeName)
            .thenComparing(ChecklistHistorySummaryRow::date));

        // Every response across the whole report (every store/day), resolved for its
        // full correction/resubmission/undo trail in one batched pass -- calling the
        // single-response buildCorrectionHistory once per detail row would be an N+1
        // across a whole date-range/multi-store report.
        List<TaskResponseEntry> allResponses = new ArrayList<>();
        for (StoreDayContext context : contexts) {
            context.responsesByTask().values().forEach(allResponses::addAll);
            allResponses.addAll(context.danglingUndoneByTask().values());
        }
        Map<Long, List<AdminCorrectionEntry>> correctionHistoriesByResponseId = allResponses.isEmpty()
            ? Map.of()
            : buildCorrectionHistories(allResponses, taskResponseEntryRepository, adminCorrectionRepository);

        List<ChecklistHistoryTaskDetailRow> details = new ArrayList<>();
        for (StoreDayContext context : contexts) {
            for (Task task : context.unionTasksById().values()) {
                String responseType = task.getResponseType().name();
                String numericUnit = task.getNumericUnit();
                List<TaskResponseEntry> responses = context.responsesByTask().getOrDefault(task.getId(), List.of());
                if (!responses.isEmpty()) {
                    for (TaskResponseEntry response : responses) {
                        boolean isIssue = response.getResponseType() == ResponseType.YES_NO
                            && Boolean.FALSE.equals(response.getValueBoolean());
                        details.add(new ChecklistHistoryTaskDetailRow(
                            context.store().getId(), context.store().getName(), context.date(),
                            task.getCategory().getName(), task.getName(), isIssue ? "ISSUE" : "COMPLETED",
                            formatResponseValue(response), response.getEmployee().getFullName(), response.getCreatedAt(),
                            correctionHistoriesByResponseId.getOrDefault(response.getId(), List.of()),
                            responseType, numericUnit
                        ));
                    }
                    continue;
                }
                // No active response -- but the employee may still have answered and then
                // explicitly Undone it with no resubmission since (same dangling-undo case
                // History surfaces): show that instead of pretending nothing happened.
                TaskResponseEntry dangling = context.danglingUndoneByTask().get(task.getId());
                if (dangling != null) {
                    details.add(new ChecklistHistoryTaskDetailRow(
                        context.store().getId(), context.store().getName(), context.date(),
                        task.getCategory().getName(), task.getName(), "NOT_COMPLETED",
                        formatUndoneValue(dangling), dangling.getEmployee().getFullName(), dangling.getUndoneAt(),
                        correctionHistoriesByResponseId.getOrDefault(dangling.getId(), List.of()),
                        responseType, numericUnit
                    ));
                } else {
                    details.add(new ChecklistHistoryTaskDetailRow(
                        context.store().getId(), context.store().getName(), context.date(),
                        task.getCategory().getName(), task.getName(), "NOT_COMPLETED", null, null, null,
                        List.of(), responseType, numericUnit
                    ));
                }
            }
            // Tasks (or tasks under a category) currently deactivated in store config,
            // with no activity of their own that day -- kept out of unionTaskIds (so they
            // never inflate the Scheduled/Completed summary counts above), but still
            // listed here so a deactivated task never silently disappears from the export.
            for (Task inactiveTask : context.inactiveTasksById().values()) {
                details.add(new ChecklistHistoryTaskDetailRow(
                    context.store().getId(), context.store().getName(), context.date(),
                    inactiveTask.getCategory().getName(), inactiveTask.getName(), "INACTIVE", null, null, null,
                    List.of(), inactiveTask.getResponseType().name(), inactiveTask.getNumericUnit()
                ));
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

    // A dangling-undone response's stored value is its stale pre-undo answer, not the
    // current state -- mirrors the frontend's identical undoneLabel (api/history.ts /
    // checklistHistoryToShiftHistory.ts) so this report reads the same way History does.
    private String formatUndoneValue(TaskResponseEntry response) {
        if (response.getResponseType() == ResponseType.YES_NO) return "No";
        if (response.getResponseType() == ResponseType.DONE_NOT_DONE) return "Not done";
        return "No answer";
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
        int issueCount,
        // Currently-deactivated tasks (task itself, or its category) configured for this
        // store, with no response of their own that day -- kept separate from
        // unionTaskIds so they never inflate the Scheduled/Completed summary counts,
        // but still resolvable for the "Inactive" detail rows in the Operations Report.
        Map<Long, Task> inactiveTasksById,
        // This store/day's most recent explicitly-Undone response per task, only for
        // tasks with zero active responses that day -- lets the Operations Report show
        // "who undid it and when" instead of a bare Not Completed row.
        Map<Long, TaskResponseEntry> danglingUndoneByTask
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
            : taskRepository.findForStoresAndDateRange(ownerId, storeIds, resolvedStart, resolvedEnd);
        Map<Long, Task> candidateTasksById = candidateTasks.stream()
            .collect(Collectors.toMap(Task::getId, task -> task, (a, b) -> a));

        // Every task ever configured for this owner (any active state), so currently
        // deactivated tasks/categories can still be listed in the Operations Report
        // even when they have no response at all that day -- findActiveForStoresAndDateRange
        // above only ever returns active ones.
        List<Task> inactiveCandidateTasks = storeIds.isEmpty()
            ? List.of()
            : taskRepository.findByOwnerIdOrderByCategoryAndDisplayOrderFetchCategory(ownerId).stream()
                .filter(task -> !task.isActive() || !task.getCategory().isActive())
                .toList();

        // Batched form of Task.stores, so per-store eligibility for scoped (non-
        // appliesToAllStores) tasks can be reconstructed without a lazy-load per task --
        // covers both the active candidates and the inactive ones above in one query.
        List<Long> scopedTaskIds = Stream.concat(candidateTasks.stream(), inactiveCandidateTasks.stream())
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

        // This store-range/date-range's dangling Undo responses (active response
        // deactivated by the employee's own explicit Undo, never resubmitted since) --
        // same "don't let it silently vanish" rule as MeHistoryService/
        // ChecklistHistoryService.getDetail, batched across every store/day at once.
        Map<Long, List<TaskResponseEntry>> danglingUndoneByStore = storeIds.isEmpty()
            ? Map.of()
            : taskResponseEntryRepository
                .findByStoreIdInAndResponseDateBetweenAndActiveFalseAndUndoneByUserTrue(storeIds, resolvedStart, resolvedEnd)
                .stream()
                .collect(Collectors.groupingBy(entry -> entry.getStore().getId()));

        // Tasks with responses but deactivated/rescoped since (not in candidateTasks
        // at all) -- fetched once across every store/date so they still appear in the
        // union instead of silently disappearing (same rule as getDetail). Includes
        // dangling-undone responses' tasks too, so a fully deactivated task whose only
        // activity was later undone still resolves to a real Task for its detail row.
        Set<Long> allRespondedTaskIds = Stream.concat(
                responsesByStore.values().stream().flatMap(List::stream),
                danglingUndoneByStore.values().stream().flatMap(List::stream)
            )
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
            List<Task> inactiveTasksForStore = inactiveCandidateTasks.stream()
                .filter(task -> task.isAppliesToAllStores()
                    || storeIdsByTaskId.getOrDefault(task.getId(), Set.of()).contains(store.getId()))
                .toList();
            Map<LocalDate, List<TaskResponseEntry>> responsesByDate = responsesByStore
                .getOrDefault(store.getId(), List.of()).stream()
                .collect(Collectors.groupingBy(TaskResponseEntry::getResponseDate));
            Map<LocalDate, List<TaskResponseEntry>> danglingUndoneByDate = danglingUndoneByStore
                .getOrDefault(store.getId(), List.of()).stream()
                .collect(Collectors.groupingBy(TaskResponseEntry::getResponseDate));

            for (LocalDate date : dates) {
                List<TaskResponseEntry> dayResponses = responsesByDate.getOrDefault(date, List.of());
                Map<Long, List<TaskResponseEntry>> responsesByTask = dayResponses.stream()
                    .collect(Collectors.groupingBy(entry -> entry.getTask().getId()));
                Set<Long> respondedTaskIds = responsesByTask.keySet();

                // Only for tasks with zero active responses today -- if a later
                // resubmission superseded the undo, that resubmission is already the
                // task's active response above and takes priority.
                Map<Long, TaskResponseEntry> danglingUndoneByTask = danglingUndoneByDate.getOrDefault(date, List.of())
                    .stream()
                    .filter(entry -> !respondedTaskIds.contains(entry.getTask().getId()))
                    .collect(Collectors.toMap(
                        entry -> entry.getTask().getId(),
                        entry -> entry,
                        (a, b) -> a.getCreatedAt().isAfter(b.getCreatedAt()) ? a : b
                    ));

                Set<Long> eligibleTaskIds = tasksForStore.stream()
                    .filter(task -> withinTaskDateRange(task, date) && TaskScheduleMatcher.matches(task, date))
                    .map(Task::getId)
                    .collect(Collectors.toSet());

                // Union, not eligible-only: a task deactivated/reconfigured after the fact
                // must never disappear from -- or under-count -- a day it actually has
                // responses for. respondedTaskIds (active responses only) still drives the
                // Completed count below -- a dangling-undone task is deliberately NOT
                // "completed", it's just no longer silently missing from the detail rows.
                Set<Long> unionTaskIds = new HashSet<>(eligibleTaskIds);
                unionTaskIds.addAll(respondedTaskIds);
                unionTaskIds.addAll(danglingUndoneByTask.keySet());
                Map<Long, Task> unionTasksById = new LinkedHashMap<>();
                for (Long taskId : unionTaskIds) {
                    Task task = candidateTasksById.getOrDefault(taskId, missingTasksById.get(taskId));
                    if (task != null) {
                        unionTasksById.put(taskId, task);
                    }
                }

                Map<Long, Task> inactiveTasksById = new LinkedHashMap<>();
                for (Task task : inactiveTasksForStore) {
                    if (!unionTaskIds.contains(task.getId())) {
                        inactiveTasksById.put(task.getId(), task);
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
                    store, date, unionTaskIds, unionTasksById, respondedTaskIds, responsesByTask, (int) issueCount,
                    inactiveTasksById, danglingUndoneByTask
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

        List<Task> eligibleTasks = taskRepository.findForStoreAndDate(ownerId, storeId, date).stream()
            .filter(task -> TaskScheduleMatcher.matches(task, date))
            .toList();

        List<TaskResponseEntry> responses = new ArrayList<>(taskResponseEntryRepository
            .findByStoreIdAndResponseDateAndActiveTrue(storeId, date));
        Map<Long, List<TaskResponseEntry>> responsesByTask = responses.stream()
            .collect(Collectors.groupingBy(entry -> entry.getTask().getId()));

        // A task answered and then explicitly Undone, with no resubmission since, has
        // zero active responses above and would otherwise disappear from history
        // entirely -- surface the most recent such dangling row per task (only where
        // no active response already covers that task) so it still shows up as "Not
        // done, Undone by X · time" instead of silently vanishing. Mirrors
        // MeHistoryService.getDetail's identical handling for the employee view.
        List<TaskResponseEntry> danglingUndone = taskResponseEntryRepository
            .findByStoreIdAndResponseDateAndActiveFalseAndUndoneByUserTrue(storeId, date);
        if (!danglingUndone.isEmpty()) {
            Map<Long, TaskResponseEntry> latestDanglingByTask = danglingUndone.stream()
                .collect(Collectors.toMap(
                    entry -> entry.getTask().getId(),
                    entry -> entry,
                    (a, b) -> a.getCreatedAt().isAfter(b.getCreatedAt()) ? a : b
                ));
            for (Map.Entry<Long, TaskResponseEntry> dangling : latestDanglingByTask.entrySet()) {
                if (responsesByTask.containsKey(dangling.getKey())) continue;
                responsesByTask.put(dangling.getKey(), List.of(dangling.getValue()));
                responses.add(dangling.getValue());
            }
        }

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

        List<Long> responseIds = responses.stream().map(TaskResponseEntry::getId).toList();
        Map<Long, AdminCorrection> latestCorrectionByResponseId = responseIds.isEmpty()
            ? Map.of()
            : adminCorrectionRepository.findLatestByResponseIds(responseIds);
        Map<Long, List<ResponseHistoryEntry>> resubmissionHistoriesByResponseId = responses.isEmpty()
            ? Map.of()
            : buildResubmissionHistories(responses, taskResponseEntryRepository, adminCorrectionRepository);

        LinkedHashMap<Long, List<Task>> tasksByCategory = new LinkedHashMap<>();
        for (Task task : allTasks) {
            tasksByCategory.computeIfAbsent(task.getCategory().getId(), key -> new ArrayList<>()).add(task);
        }

        List<HistoryCategoryResponse> categories = tasksByCategory.values().stream()
            .map(tasks -> new HistoryCategoryResponse(
                tasks.get(0).getCategory().getId(),
                tasks.get(0).getCategory().getName(),
                tasks.stream()
                    .map(task -> toHistoryTaskItem(
                        task, responsesByTask.getOrDefault(task.getId(), List.of()),
                        empIdByUserId, latestCorrectionByResponseId, resubmissionHistoriesByResponseId))
                    .toList()
            ))
            .toList();

        List<HistoryIssueResponse> issues = raisedIssueRepository
            .findByStoreIdAndRaisedDateOrderByCreatedAtDesc(storeId, date).stream()
            .map(HistoryIssueResponse::from)
            .toList();

        return new ChecklistHistoryDetailResponse(store.getId(), store.getName(), date, !allTasks.isEmpty(), categories, issues);
    }

    // Walks a response's supersededResponseId chain back to its origin, pairing each
    // hop with the FLAG_TO_EMPLOYEE admin_corrections row that caused it (for the
    // flag reason / flagged-by / flagged-at) -- oldest first. Shared by
    // ChecklistHistoryService, MeHistoryService, and AdminCorrectionService, the
    // same way toCorrectionEntry already is, rather than duplicating this walk in
    // each of them.
    static List<ResponseHistoryEntry> buildResubmissionHistory(
        TaskResponseEntry entry,
        TaskResponseEntryRepository responseRepository,
        AdminCorrectionRepository correctionRepository
    ) {
        return buildResubmissionHistories(List.of(entry), responseRepository, correctionRepository)
            .getOrDefault(entry.getId(), List.of());
    }

    // Batched form of the above: resolves every response's supersededResponseId chain
    // with a small, fixed number of round trips across ALL responses at once (one
    // findAllById + one correction lookup per "hop depth"), instead of one findById plus
    // one correction query per hop, per response. Used when rendering a whole page of
    // responses at once (checklist history detail); the single-response overload above
    // still serves the one-off admin correction/flag actions in AdminCorrectionService.
    static Map<Long, List<ResponseHistoryEntry>> buildResubmissionHistories(
        Collection<TaskResponseEntry> responses,
        TaskResponseEntryRepository responseRepository,
        AdminCorrectionRepository correctionRepository
    ) {
        Map<Long, TaskResponseEntry> resolved = new LinkedHashMap<>();
        Set<Long> frontier = responses.stream()
            .map(TaskResponseEntry::getSupersededResponseId)
            .filter(Objects::nonNull)
            .collect(Collectors.toCollection(LinkedHashSet::new));

        while (!frontier.isEmpty()) {
            Set<Long> nextFrontier = new LinkedHashSet<>();
            for (TaskResponseEntry historical : responseRepository.findAllById(frontier)) {
                resolved.put(historical.getId(), historical);
                Long next = historical.getSupersededResponseId();
                if (next != null && !resolved.containsKey(next)) {
                    nextFrontier.add(next);
                }
            }
            frontier = nextFrontier;
        }

        Map<Long, AdminCorrection> latestFlagByResponseId = resolved.isEmpty()
            ? Map.of()
            : correctionRepository.findByTaskResponseIdIn(resolved.keySet()).stream()
                .filter(c -> "FLAG_TO_EMPLOYEE".equals(c.getCorrectionType()))
                .collect(Collectors.toMap(
                    c -> c.getTaskResponse().getId(),
                    c -> c,
                    (a, b) -> a.getCorrectedAt().isAfter(b.getCorrectedAt()) ? a : b
                ));

        Map<Long, List<ResponseHistoryEntry>> result = new LinkedHashMap<>();
        for (TaskResponseEntry entry : responses) {
            List<ResponseHistoryEntry> chain = new ArrayList<>();
            Long supersededId = entry.getSupersededResponseId();
            while (supersededId != null) {
                TaskResponseEntry historical = resolved.get(supersededId);
                if (historical == null) {
                    break;
                }
                AdminCorrection flag = latestFlagByResponseId.get(historical.getId());
                chain.add(new ResponseHistoryEntry(
                    historical.getId(),
                    historical.getValueBoolean(),
                    historical.getValueNumeric(),
                    historical.getValueText(),
                    historical.getCreatedAt(),
                    historical.getEmployee().getFullName(),
                    flag != null ? flag.getReason() : historical.getFlagReason(),
                    flag != null ? (flag.getCorrectedBy() != null ? flag.getCorrectedBy().getFullName() : flag.getCorrectedByName()) : null,
                    flag != null ? flag.getCorrectedAt() : null,
                    historical.isUndoneByUser()
                ));
                supersededId = historical.getSupersededResponseId();
            }
            Collections.reverse(chain);
            result.put(entry.getId(), chain);
        }
        return result;
    }

    // Batched form of buildCorrectionHistory below: resolves every response's
    // supersededResponseId chain with a small, fixed number of round trips across ALL
    // responses at once (one findAllById per "hop depth", same frontier walk
    // buildResubmissionHistories already uses, plus one batched admin_corrections
    // lookup), instead of one findById per hop per response. Used when rendering a
    // whole report at once (Daily Operations Report export); the single-response
    // overload still serves the one-off "View response history" fetch.
    static Map<Long, List<AdminCorrectionEntry>> buildCorrectionHistories(
        Collection<TaskResponseEntry> responses,
        TaskResponseEntryRepository taskResponseEntryRepository,
        AdminCorrectionRepository adminCorrectionRepository
    ) {
        Map<Long, TaskResponseEntry> resolved = new LinkedHashMap<>();
        Set<Long> frontier = responses.stream()
            .map(TaskResponseEntry::getSupersededResponseId)
            .filter(Objects::nonNull)
            .collect(Collectors.toCollection(LinkedHashSet::new));

        while (!frontier.isEmpty()) {
            Set<Long> nextFrontier = new LinkedHashSet<>();
            for (TaskResponseEntry historical : taskResponseEntryRepository.findAllById(frontier)) {
                resolved.put(historical.getId(), historical);
                Long next = historical.getSupersededResponseId();
                if (next != null && !resolved.containsKey(next)) {
                    nextFrontier.add(next);
                }
            }
            frontier = nextFrontier;
        }

        // Each response's own full chain (self + resolved ancestors), newest first --
        // same construction as buildCorrectionHistory's local `chain`, just reusing the
        // batch-resolved ancestors above instead of one findById per hop.
        Map<Long, List<TaskResponseEntry>> chainsByResponseId = new LinkedHashMap<>();
        Set<Long> allChainIds = new LinkedHashSet<>();
        for (TaskResponseEntry entry : responses) {
            List<TaskResponseEntry> chain = new ArrayList<>();
            chain.add(entry);
            allChainIds.add(entry.getId());
            Long supersededId = entry.getSupersededResponseId();
            while (supersededId != null) {
                TaskResponseEntry prior = resolved.get(supersededId);
                if (prior == null) {
                    break;
                }
                chain.add(prior);
                allChainIds.add(prior.getId());
                supersededId = prior.getSupersededResponseId();
            }
            chainsByResponseId.put(entry.getId(), chain);
        }

        Map<Long, List<AdminCorrection>> rawCorrectionsByResponseId = allChainIds.isEmpty()
            ? Map.of()
            : adminCorrectionRepository.findByTaskResponseIdIn(allChainIds).stream()
                .collect(Collectors.groupingBy(c -> c.getTaskResponse().getId()));

        Map<Long, List<AdminCorrectionEntry>> result = new LinkedHashMap<>();
        for (TaskResponseEntry entry : responses) {
            List<TaskResponseEntry> chain = chainsByResponseId.get(entry.getId());

            List<AdminCorrectionEntry> combined = new ArrayList<>();
            for (TaskResponseEntry hop : chain) {
                for (AdminCorrection c : rawCorrectionsByResponseId.getOrDefault(hop.getId(), List.of())) {
                    combined.add(toCorrectionEntry(c));
                }
            }

            // One synthesized entry per hop: the employee's own act of resubmitting a new
            // answer that replaced the previous one -- see buildCorrectionHistory for why
            // this is distinct from a DIRECT/FLAG_TO_EMPLOYEE admin_corrections row.
            for (int i = 0; i < chain.size() - 1; i++) {
                TaskResponseEntry newer = chain.get(i);
                TaskResponseEntry older = chain.get(i + 1);
                combined.add(new AdminCorrectionEntry(
                    null,
                    older.getValueBoolean(), older.getValueNumeric(), older.getValueText(),
                    newer.getValueBoolean(), newer.getValueNumeric(), newer.getValueText(),
                    newer.getEmployee().getFullName(),
                    newer.getCreatedAt(),
                    null,
                    "RESUBMISSION"
                ));
            }

            // One synthesized entry per hop the employee explicitly Undid -- see
            // buildCorrectionHistory for why this covers both the chain's head (a
            // dangling response) and any earlier hop undone mid-chain.
            for (TaskResponseEntry hop : chain) {
                if (hop.isUndoneByUser()) {
                    combined.add(new AdminCorrectionEntry(
                        null,
                        hop.getValueBoolean(), hop.getValueNumeric(), hop.getValueText(),
                        null, null, null,
                        hop.getEmployee().getFullName(),
                        hop.getUndoneAt(),
                        null,
                        "UNDONE"
                    ));
                }
            }

            combined.sort(Comparator.comparing(AdminCorrectionEntry::correctedAt).reversed());
            result.put(entry.getId(), combined);
        }
        return result;
    }

    // Full correction/resubmission audit trail for one response, walking the entire
    // supersededResponseId chain (this response, then each one it replaced, oldest
    // last) so a correction/flag logged against an earlier link -- before a
    // flag->resubmit or a MULTIPLE-task resubmission -- doesn't disappear once that
    // row is superseded. Shared by AdminCorrectionService (owner/admin) and
    // MeHistoryService (employee) so both surfaces return the identical trail; only
    // the caller-side authorization differs.
    static List<AdminCorrectionEntry> buildCorrectionHistory(
        TaskResponseEntry entry,
        TaskResponseEntryRepository taskResponseEntryRepository,
        AdminCorrectionRepository adminCorrectionRepository
    ) {
        List<TaskResponseEntry> chain = new ArrayList<>();
        chain.add(entry);
        TaskResponseEntry current = entry;
        while (current.getSupersededResponseId() != null) {
            TaskResponseEntry prior = taskResponseEntryRepository.findById(current.getSupersededResponseId())
                .orElse(null);
            if (prior == null) {
                break;
            }
            chain.add(prior);
            current = prior;
        }

        List<Long> chainIds = chain.stream().map(TaskResponseEntry::getId).toList();
        List<AdminCorrectionEntry> combined = new ArrayList<>(
            adminCorrectionRepository.findByTaskResponseIdIn(chainIds).stream()
                .map(ChecklistHistoryService::toCorrectionEntry)
                .toList()
        );

        // One synthesized entry per hop: the employee's own act of resubmitting a new
        // answer that replaced the previous one. Distinct from a DIRECT admin edit or a
        // FLAG_TO_EMPLOYEE action (both already captured above from admin_corrections),
        // so "all changes" -- not just admin-made ones -- show up in one merged history.
        for (int i = 0; i < chain.size() - 1; i++) {
            TaskResponseEntry newer = chain.get(i);
            TaskResponseEntry older = chain.get(i + 1);
            combined.add(new AdminCorrectionEntry(
                null,
                older.getValueBoolean(), older.getValueNumeric(), older.getValueText(),
                newer.getValueBoolean(), newer.getValueNumeric(), newer.getValueText(),
                newer.getEmployee().getFullName(),
                newer.getCreatedAt(),
                null,
                "RESUBMISSION"
            ));
        }

        // One synthesized entry per hop the employee explicitly Undid (as opposed to
        // one that was simply superseded by a fresh resubmission) -- covers both the
        // chain's head (a dangling response with no resubmission since, surfaced by
        // MeHistoryService/ChecklistHistoryService.getDetail specifically so this
        // trail has something to show) and any earlier hop undone mid-chain before
        // being resubmitted later, so an undo-then-redo cycle shows "value -> Not
        // done (undone)" distinctly instead of collapsing into a same-value-looking
        // RESUBMISSION line above.
        for (TaskResponseEntry hop : chain) {
            if (hop.isUndoneByUser()) {
                combined.add(new AdminCorrectionEntry(
                    null,
                    hop.getValueBoolean(), hop.getValueNumeric(), hop.getValueText(),
                    null, null, null,
                    hop.getEmployee().getFullName(),
                    hop.getUndoneAt(),
                    null,
                    "UNDONE"
                ));
            }
        }

        return combined.stream()
            .sorted(Comparator.comparing(AdminCorrectionEntry::correctedAt).reversed())
            .toList();
    }

    static AdminCorrectionEntry toCorrectionEntry(AdminCorrection c) {
        return new AdminCorrectionEntry(
            c.getId(),
            c.getOriginalValueBoolean(),
            c.getOriginalValueNumeric(),
            c.getOriginalValueText(),
            c.getCorrectedValueBoolean(),
            c.getCorrectedValueNumeric(),
            c.getCorrectedValueText(),
            c.getCorrectedBy() != null ? c.getCorrectedBy().getFullName() : c.getCorrectedByName(),
            c.getCorrectedAt(),
            c.getReason(),
            c.getCorrectionType()
        );
    }

    private HistoryTaskItemResponse toHistoryTaskItem(
        Task task, List<TaskResponseEntry> responses, Map<Long, String> empIdByUserId,
        Map<Long, AdminCorrection> latestCorrectionByResponseId,
        Map<Long, List<ResponseHistoryEntry>> resubmissionHistoriesByResponseId
    ) {
        List<HistoryResponseEntryResponse> responseDtos = responses.stream()
            .map(entry -> {
                AdminCorrection correction = latestCorrectionByResponseId.get(entry.getId());
                return new HistoryResponseEntryResponse(
                    entry.getId(),
                    entry.getEmployee().getId(),
                    entry.getEmployee().getFullName(),
                    empIdByUserId.get(entry.getEmployee().getId()),
                    entry.getValueBoolean(),
                    entry.getValueNumeric(),
                    entry.getValueText(),
                    // See MeHistoryService's identical handling: a dangling-undo entry's
                    // value fields are its stale pre-undo value, so its "as of" time is the
                    // undo itself, not the original submission.
                    entry.isActive() ? entry.getCreatedAt() : entry.getUndoneAt(),
                    correction != null ? toCorrectionEntry(correction) : null,
                    entry.getEmployee().getAvatarUrl(),
                    entry.isFlaggedNeedsCorrection(),
                    entry.getFlagReason(),
                    resubmissionHistoriesByResponseId.getOrDefault(entry.getId(), List.of()),
                    !entry.isActive()
                );
            })
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
