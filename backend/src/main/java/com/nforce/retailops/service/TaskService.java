package com.nforce.retailops.service;

import com.nforce.retailops.dto.CategoryChecklistResponse;
import com.nforce.retailops.dto.TaskChecklistItemResponse;
import com.nforce.retailops.dto.TaskRequest;
import com.nforce.retailops.dto.TaskResponse;
import com.nforce.retailops.dto.TaskResponseStateResponse;
import com.nforce.retailops.dto.TaskResponseSubmitRequest;
import com.nforce.retailops.dto.TaskResponseSummary;
import com.nforce.retailops.dto.TodayChecklistResponse;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.DayOfWeekCode;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.exception.CategoryNotFoundException;
import com.nforce.retailops.exception.InvalidStoreSelectionException;
import com.nforce.retailops.exception.InvalidTaskConfigurationException;
import com.nforce.retailops.exception.InvalidTaskResponseException;
import com.nforce.retailops.exception.StoreInactiveException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.exception.TaskAlreadyCompletedException;
import com.nforce.retailops.exception.TaskNotFoundException;
import com.nforce.retailops.exception.TaskResponseNotFoundException;
import com.nforce.retailops.exception.UnauthorizedTaskResponseActionException;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
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
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;
    private final UserProfileService userProfileService;
    private final TaskResponseEntryRepository taskResponseEntryRepository;

    public TaskService(
        TaskRepository taskRepository,
        CategoryRepository categoryRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreRepository storeRepository,
        UserRepository userRepository,
        UserProfileService userProfileService,
        TaskResponseEntryRepository taskResponseEntryRepository
    ) {
        this.taskRepository = taskRepository;
        this.categoryRepository = categoryRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeRepository = storeRepository;
        this.userRepository = userRepository;
        this.userProfileService = userProfileService;
        this.taskResponseEntryRepository = taskResponseEntryRepository;
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

    /**
     * The checklist an employee sees "today" for one of their assigned stores:
     * active tasks belonging to that store's owner, scoped to the store (either
     * applies-to-all-stores or a specific task_stores entry), whose schedule
     * matches today's day of week and whose active date range covers today --
     * grouped by category in the owner's configured category and task order.
     */
    @Transactional(readOnly = true)
    public TodayChecklistResponse getTodayChecklistForEmployee(Long employeeUserId, Long storeId) {
        userProfileService.requireAssignedStore(employeeUserId, storeId);

        Long ownerId = storeOwnerRepository.findByStoreId(storeId)
            .map(storeOwner -> storeOwner.getOwner().getId())
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));

        LocalDate today = LocalDate.now();
        DayOfWeekCode todayCode = DayOfWeekCode.valueOf(today.getDayOfWeek().name().substring(0, 3));

        List<Task> applicableTasks = taskRepository.findActiveForStoreAndDate(ownerId, storeId, today).stream()
            .filter(task -> matchesSchedule(task, today, todayCode))
            .toList();

        // Batched instead of one active-responses query per task, so the checklist read
        // stays O(1) queries regardless of how many tasks are on it.
        List<Long> taskIds = applicableTasks.stream().map(Task::getId).toList();
        Map<Long, List<TaskResponseEntry>> responsesByTask = taskIds.isEmpty()
            ? Map.of()
            : taskResponseEntryRepository.findByTaskIdInAndStoreIdAndResponseDateAndActiveTrue(taskIds, storeId, today).stream()
                .collect(Collectors.groupingBy(entry -> entry.getTask().getId()));

        LinkedHashMap<Long, List<Task>> tasksByCategory = new LinkedHashMap<>();
        for (Task task : applicableTasks) {
            tasksByCategory.computeIfAbsent(task.getCategory().getId(), key -> new ArrayList<>()).add(task);
        }

        List<CategoryChecklistResponse> categories = tasksByCategory.values().stream()
            .map(tasks -> new CategoryChecklistResponse(
                tasks.get(0).getCategory().getId(),
                tasks.get(0).getCategory().getName(),
                tasks.stream()
                    .map(task -> TaskChecklistItemResponse.from(
                        task, responsesByTask.getOrDefault(task.getId(), List.of()), employeeUserId))
                    .toList()
            ))
            .toList();

        return new TodayChecklistResponse(storeId, today, categories);
    }

    /**
     * Submit an employee's answer to a task for one of their assigned stores, for
     * today's scheduled date. SINGLE: rejected outright if an active response already
     * exists for this task/store/day (first employee to respond wins, regardless of
     * who they are). MULTIPLE: always allowed, including repeats by the same employee.
     */
    @Transactional
    public TaskResponseStateResponse submitResponse(Long employeeUserId, Long taskId, TaskResponseSubmitRequest request) {
        userProfileService.requireAssignedStore(employeeUserId, request.storeId());
        Task task = requireTaskForStore(taskId, request.storeId());

        LocalDate today = LocalDate.now();
        List<TaskResponseEntry> activeResponses = taskResponseEntryRepository
            .findByTaskIdAndStoreIdAndResponseDateAndActiveTrue(taskId, request.storeId(), today);

        if (task.getCompletionType() == CompletionType.SINGLE && !activeResponses.isEmpty()) {
            throw new TaskAlreadyCompletedException("This task has already been completed for today");
        }

        TaskResponseEntry entry = new TaskResponseEntry();
        entry.setTask(task);
        entry.setStore(storeRepository.getReferenceById(request.storeId()));
        entry.setEmployee(userRepository.getReferenceById(employeeUserId));
        entry.setResponseDate(today);
        entry.setResponseType(task.getResponseType());
        entry.setCompletionType(task.getCompletionType());
        applyValue(entry, task.getResponseType(), request);

        // The above pre-check is only a fast path (avoids a DB round trip for the common
        // case) -- it can't stop two concurrent submits from both passing it before either
        // commits. The partial unique index (V19) is what actually enforces "first active
        // response wins" for SINGLE tasks; a violation here means we lost that race.
        try {
            taskResponseEntryRepository.save(entry);
            taskResponseEntryRepository.flush();
        } catch (DataIntegrityViolationException ex) {
            throw new TaskAlreadyCompletedException("This task has already been completed for today");
        }

        return buildResponseState(taskId, request.storeId(), today, employeeUserId);
    }

    /**
     * Reopen a task by deactivating the calling employee's own response. The row is
     * kept (active=false, undoneAt set) rather than deleted, so the record/history
     * survives the undo -- only the employee who submitted it may undo it.
     */
    @Transactional
    public TaskResponseStateResponse undoResponse(Long employeeUserId, Long taskId, Long storeId, Long responseId) {
        userProfileService.requireAssignedStore(employeeUserId, storeId);
        requireTaskForStore(taskId, storeId);

        TaskResponseEntry entry = taskResponseEntryRepository.findByIdAndTaskIdAndStoreId(responseId, taskId, storeId)
            .filter(TaskResponseEntry::isActive)
            .orElseThrow(() -> new TaskResponseNotFoundException("Response not found"));

        if (!entry.getEmployee().getId().equals(employeeUserId)) {
            throw new UnauthorizedTaskResponseActionException("Only the employee who submitted this response can undo it");
        }

        entry.setActive(false);
        entry.setUndoneAt(OffsetDateTime.now());
        taskResponseEntryRepository.save(entry);

        return buildResponseState(taskId, storeId, entry.getResponseDate(), employeeUserId);
    }

    private TaskResponseStateResponse buildResponseState(Long taskId, Long storeId, LocalDate date, Long employeeUserId) {
        List<TaskResponseEntry> active = taskResponseEntryRepository
            .findByTaskIdAndStoreIdAndResponseDateAndActiveTrue(taskId, storeId, date);
        List<TaskResponseSummary> summaries = active.stream().map(TaskResponseSummary::from).toList();
        boolean canUndo = active.stream().anyMatch(entry -> entry.getEmployee().getId().equals(employeeUserId));
        return new TaskResponseStateResponse(taskId, summaries, canUndo);
    }

    // Same store-membership check the checklist query applies (applies-to-all-stores,
    // or a specific task_stores entry) -- an employee cannot respond to a task that
    // was never offered to their store, even if they know its id.
    private Task requireTaskForStore(Long taskId, Long storeId) {
        Task task = taskRepository.findById(taskId)
            .filter(Task::isActive)
            .orElseThrow(() -> new TaskNotFoundException("Task not found"));

        boolean appliesToStore = task.isAppliesToAllStores()
            || task.getStores().stream().anyMatch(store -> store.getId().equals(storeId));
        if (!appliesToStore) {
            throw new TaskNotFoundException("Task not found");
        }
        return task;
    }

    private void applyValue(TaskResponseEntry entry, ResponseType responseType, TaskResponseSubmitRequest request) {
        switch (responseType) {
            case YES_NO, DONE_NOT_DONE -> {
                if (request.booleanValue() == null) {
                    throw new InvalidTaskResponseException("A Yes/No response is required");
                }
                entry.setValueBoolean(request.booleanValue());
            }
            case NUMERIC -> {
                if (request.numericValue() == null) {
                    throw new InvalidTaskResponseException("A numeric response is required");
                }
                entry.setValueNumeric(request.numericValue());
            }
            case TEXT -> {
                if (request.textValue() == null) {
                    throw new InvalidTaskResponseException("A text response is required");
                }
                entry.setValueText(request.textValue());
            }
        }
    }

    private boolean matchesSchedule(Task task, LocalDate date, DayOfWeekCode todayCode) {
        return switch (task.getScheduleType()) {
            case EVERY_DAY -> true;
            case WEEKDAYS -> date.getDayOfWeek().getValue() <= 5;
            case WEEKENDS -> date.getDayOfWeek().getValue() >= 6;
            case SELECTED_DAYS -> task.getSelectedDays().contains(todayCode);
        };
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
        if (owned.stream().anyMatch(so -> !so.isActive())) {
            throw new StoreInactiveException("One or more selected stores have been deactivated");
        }

        return owned.stream().map(StoreOwner::getStore).collect(Collectors.toSet());
    }

    private static String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
