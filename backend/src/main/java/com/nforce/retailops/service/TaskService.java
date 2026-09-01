package com.nforce.retailops.service;

import com.nforce.retailops.dto.EmployeeChecklistCategoryResponse;
import com.nforce.retailops.dto.EmployeeTaskResponse;
import com.nforce.retailops.dto.TaskRequest;
import com.nforce.retailops.dto.TaskResponse;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.DayOfWeekCode;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.exception.CategoryNotFoundException;
import com.nforce.retailops.exception.InvalidStoreSelectionException;
import com.nforce.retailops.exception.InvalidTaskConfigurationException;
import com.nforce.retailops.exception.TaskNotFoundException;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class TaskService {

    private static final Pattern ALPHANUMERIC_WITH_SPACES = Pattern.compile("^[A-Za-z0-9 ]*$");
    private static final int SHORT_TEXT_MAX_LENGTH = 25;

    private final TaskRepository taskRepository;
    private final CategoryRepository categoryRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final UserRepository userRepository;

    public TaskService(
        TaskRepository taskRepository,
        CategoryRepository categoryRepository,
        StoreOwnerRepository storeOwnerRepository,
        UserRepository userRepository
    ) {
        this.taskRepository = taskRepository;
        this.categoryRepository = categoryRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> listTasks(Long ownerId) {
        return taskRepository.findByOwnerIdOrderByCategoryAndDisplayOrder(ownerId).stream()
            .map(TaskResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public TaskResponse getTask(Long ownerId, Long taskId) {
        return TaskResponse.from(requireOwnedTask(ownerId, taskId));
    }

    @Transactional
    public TaskResponse createTask(Long ownerId, TaskRequest request) {
        Task task = new Task();
        task.setOwner(userRepository.getReferenceById(ownerId));
        applyRequest(task, ownerId, request);
        task = taskRepository.save(task);
        return TaskResponse.from(task);
    }

    @Transactional
    public TaskResponse updateTask(Long ownerId, Long taskId, TaskRequest request) {
        Task task = requireOwnedTask(ownerId, taskId);
        applyRequest(task, ownerId, request);
        task = taskRepository.save(task);
        return TaskResponse.from(task);
    }

    @Transactional
    public TaskResponse setActive(Long ownerId, Long taskId, boolean active) {
        Task task = requireOwnedTask(ownerId, taskId);
        task.setActive(active);
        task = taskRepository.save(task);
        return TaskResponse.from(task);
    }

    @Transactional
    public void deleteTask(Long ownerId, Long taskId) {
        Task task = requireOwnedTask(ownerId, taskId);
        // NOTE: no employee task-completion/history entity exists yet. Once one does,
        // check for existing completion records here and refuse deletion (or require an
        // extra confirmation) the same way the frontend already warns about it.
        taskRepository.delete(task);
    }

    // Employee checklist: active tasks applicable to the given store, grouped by
    // category in the same order as Task Management. Reuses the same Task entity
    // and repository query the admin list uses -- only the response shape differs,
    // to avoid exposing admin-only fields (owner, stores, schedule, dates).
    @Transactional(readOnly = true)
    public List<EmployeeChecklistCategoryResponse> getEmployeeChecklist(Long ownerId, Long storeId) {
        List<Task> tasks = taskRepository.findActiveForOwnerApplicableToStore(ownerId, storeId);

        Map<Long, String> categoryNames = new LinkedHashMap<>();
        Map<Long, List<EmployeeTaskResponse>> tasksByCategory = new LinkedHashMap<>();
        for (Task task : tasks) {
            Long categoryId = task.getCategory().getId();
            categoryNames.putIfAbsent(categoryId, task.getCategory().getName());
            tasksByCategory.computeIfAbsent(categoryId, key -> new ArrayList<>()).add(EmployeeTaskResponse.from(task));
        }

        return categoryNames.entrySet().stream()
            .map(entry -> new EmployeeChecklistCategoryResponse(entry.getKey(), entry.getValue(), tasksByCategory.get(entry.getKey())))
            .toList();
    }

    private Task requireOwnedTask(Long ownerId, Long taskId) {
        return taskRepository.findByIdAndOwnerId(taskId, ownerId)
            .orElseThrow(() -> new TaskNotFoundException("Task not found"));
    }

    private void applyRequest(Task task, Long ownerId, TaskRequest request) {
        Category category = categoryRepository.findByIdAndOwnerId(request.categoryId(), ownerId)
            .orElseThrow(() -> new CategoryNotFoundException("Category not found"));

        task.setName(request.name().trim());
        task.setDescription(blankToNull(request.description()));
        task.setCategory(category);

        if (request.displayOrder() != null) {
            task.setDisplayOrder(request.displayOrder());
        } else if (task.getId() == null) {
            // New task with no explicit order: append to the end of its category,
            // mirroring how Category itself auto-assigns display order.
            task.setDisplayOrder(taskRepository.countByCategoryId(category.getId()));
        }

        task.setAppliesToAllStores(request.appliesToAllStores());
        task.setStores(resolveStores(ownerId, request));

        task.setResponseType(request.responseType());
        if (request.responseType() == ResponseType.NUMERIC) {
            if (request.numericMin() != null && request.numericMax() != null && request.numericMin() > request.numericMax()) {
                throw new InvalidTaskConfigurationException("Minimum Value cannot be greater than Maximum Value");
            }
            task.setNumericUnit(blankToNull(request.numericUnit()));
            task.setNumericMin(request.numericMin());
            task.setNumericMax(request.numericMax());
            task.setTextMaxLength(null);
            task.setResponseNote(null);
        } else if (request.responseType() == ResponseType.TEXT) {
            // Short Text is the employee's response and is optional: empty is valid, and the
            // employee must be able to complete the task without entering anything.
            String employeeResponse = blankToNull(request.responseNote());
            if (employeeResponse != null) {
                if (employeeResponse.length() > SHORT_TEXT_MAX_LENGTH || !ALPHANUMERIC_WITH_SPACES.matcher(employeeResponse).matches()) {
                    throw new InvalidTaskConfigurationException(
                        "Short Text response must be " + SHORT_TEXT_MAX_LENGTH + " alphanumeric characters or fewer");
                }
            }
            task.setResponseNote(employeeResponse);
            task.setTextMaxLength(SHORT_TEXT_MAX_LENGTH);
            task.setNumericUnit(null);
            task.setNumericMin(null);
            task.setNumericMax(null);
        } else {
            task.setResponseNote(blankToNull(request.responseNote()));
            task.setNumericUnit(null);
            task.setNumericMin(null);
            task.setNumericMax(null);
            task.setTextMaxLength(null);
        }

        task.setCompletionType(request.completionType());
        if (request.completionType() == CompletionType.MULTIPLE) {
            if (request.maxCompletions() != null && request.maxCompletions() < 1) {
                throw new InvalidTaskConfigurationException("Maximum Completions must be a positive whole number");
            }
            task.setMaxCompletions(request.maxCompletions());
        } else {
            task.setMaxCompletions(null);
        }

        task.setScheduleType(request.scheduleType());
        Set<DayOfWeekCode> selectedDays = request.scheduleType() == ScheduleType.SELECTED_DAYS
            ? new HashSet<>(request.selectedDays() == null ? List.of() : request.selectedDays())
            : new HashSet<>();
        task.setSelectedDays(selectedDays);

        task.setStartDate(request.startDate());
        task.setEndDate(request.endDate());

        task.setTimeMode(request.timeMode());
        if (request.timeMode() == TimeMode.WINDOW) {
            task.setStartTime(request.startTime());
            task.setEndTime(request.endTime());
        } else {
            task.setStartTime(null);
            task.setEndTime(null);
        }

        task.setActive(request.active());
    }

    private Set<Store> resolveStores(Long ownerId, TaskRequest request) {
        if (request.appliesToAllStores()) {
            return new HashSet<>();
        }

        List<Long> storeIds = request.storeIds() == null ? List.of() : request.storeIds();
        if (storeIds.isEmpty()) {
            throw new InvalidStoreSelectionException("Select at least one store, or choose All Stores");
        }

        List<StoreOwner> owned = storeOwnerRepository.findByOwnerIdAndStoreIdIn(ownerId, storeIds);
        if (owned.size() != Set.copyOf(storeIds).size()) {
            throw new InvalidStoreSelectionException("One or more selected stores could not be found");
        }

        return owned.stream().map(StoreOwner::getStore).collect(Collectors.toSet());
    }

    private static String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
