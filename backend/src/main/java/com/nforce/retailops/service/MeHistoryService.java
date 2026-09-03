package com.nforce.retailops.service;

import com.nforce.retailops.dto.ChecklistHistoryDetailResponse;
import com.nforce.retailops.dto.HistoryCategoryResponse;
import com.nforce.retailops.dto.HistoryResponseEntryResponse;
import com.nforce.retailops.dto.HistoryTaskItemResponse;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Employee-facing read model over historical checklist data -- the "Employee
 * History" page's real backend, replacing what was previously frontend mock
 * data. Deliberately a sibling of ChecklistHistoryService (the owner/admin
 * equivalent) rather than a shared/refactored dependency: similar eligible-
 * tasks-unioned-with-responded-tasks reconstruction (so a deactivated/
 * reconfigured task never disappears from history), but with two isolation
 * differences from the owner view: (1) store access is scoped to a single
 * employee's assigned store via UserProfileService instead of an owner's store
 * ownership, and (2) task_responses are additionally scoped to that employee's
 * OWN responses (findByStoreIdAndResponseDateAndEmployeeIdAndActiveTrue) --
 * this is the caller's personal history, never a teammate's activity.
 */
@Service
public class MeHistoryService {

    private final TaskRepository taskRepository;
    private final TaskResponseEntryRepository taskResponseEntryRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;
    private final UserProfileService userProfileService;

    public MeHistoryService(
        TaskRepository taskRepository,
        TaskResponseEntryRepository taskResponseEntryRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        UserProfileService userProfileService
    ) {
        this.taskRepository = taskRepository;
        this.taskResponseEntryRepository = taskResponseEntryRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.userProfileService = userProfileService;
    }

    @Transactional(readOnly = true)
    public ChecklistHistoryDetailResponse getDetail(Long employeeUserId, Long storeId, LocalDate date) {
        userProfileService.requireAssignedStore(employeeUserId, storeId);

        StoreOwner storeOwner = storeOwnerRepository.findByStoreId(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        Store store = storeOwner.getStore();
        Long ownerId = storeOwner.getOwner().getId();

        List<Task> eligibleTasks = taskRepository.findActiveForStoreAndDate(ownerId, storeId, date).stream()
            .filter(task -> TaskScheduleMatcher.matches(task, date))
            .toList();

        // Data isolation: this is the caller's OWN history, not the store's whole
        // team activity like the owner-facing detail -- scoped by employeeUserId in
        // addition to storeId/date, so a teammate's response (same store, same day)
        // and this employee's responses at any other store never appear here.
        List<TaskResponseEntry> responses = taskResponseEntryRepository
            .findByStoreIdAndResponseDateAndEmployeeIdAndActiveTrue(storeId, date, employeeUserId);
        Map<Long, List<TaskResponseEntry>> responsesByTask = responses.stream()
            .collect(Collectors.groupingBy(entry -> entry.getTask().getId()));

        Set<Long> eligibleTaskIds = eligibleTasks.stream().map(Task::getId).collect(Collectors.toSet());
        Set<Long> missingTaskIds = responsesByTask.keySet().stream()
            .filter(id -> !eligibleTaskIds.contains(id))
            .collect(Collectors.toSet());

        // Deliberately NOT applied for today: Today's History must mirror the live
        // Daily Checklist (/api/me/tasks/today, driven by the exact same
        // findActiveForStoreAndDate + TaskScheduleMatcher call above) exactly -- a
        // task deactivated/rescoped later the same day it was answered must
        // disappear from both together, not linger in History alone. The response
        // row itself is never deleted, so once "today" becomes a past date this
        // union picks it back up there, same as any other historical response.
        boolean isPastDate = date.isBefore(LocalDate.now());

        List<Task> allTasks = new ArrayList<>(eligibleTasks);
        if (isPastDate && !missingTaskIds.isEmpty()) {
            // Tasks with real responses that no longer show up under the current
            // config (deactivated, rescoped away, schedule changed) -- fetched by id
            // so their historical responses are never silently dropped from a past
            // date's view.
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
}
