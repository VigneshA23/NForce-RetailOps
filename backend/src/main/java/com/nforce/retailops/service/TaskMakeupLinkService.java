package com.nforce.retailops.service;

import com.nforce.retailops.dto.MissedTaskDateGroupResponse;
import com.nforce.retailops.dto.MissedTaskInstanceResponse;
import com.nforce.retailops.dto.MissedTaskLinkResponse;
import com.nforce.retailops.dto.MissedTasksPageResponse;
import com.nforce.retailops.entity.CompletedVia;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.MakeupLinkStatus;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskMakeupLink;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.exception.TaskMakeupLinkNotEligibleException;
import com.nforce.retailops.exception.TaskMakeupLinkNotFoundException;
import com.nforce.retailops.exception.TaskNotFoundException;
import com.nforce.retailops.exception.UnauthorizedTaskResponseActionException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.TaskMakeupLinkRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * "Missed Tasks": lets any employee complete a past-day task instance that was never
 * answered (a "missed instance"), either immediately (Complete Now) or by deferring it
 * to today's occurrence of the same task (a PENDING TaskMakeupLink, auto-fulfilled when
 * today's instance is completed -- see fulfillPendingLinksIfCompleted, called from
 * TaskService.submitResponse).
 *
 * A missed instance is defined the same way "is this task/day Completed" is determined
 * everywhere else in the app (CompletionType.isSatisfiedBy on distinct active
 * responders), NOT merely "zero responses" -- so a MULTIPLE task with exactly one
 * responder still shows as missed (state WAITING_ON_SECOND for that responder, still
 * ACTIONABLE for anyone else), matching the live checklist's own "X/Y responded" rule.
 */
@Service
public class TaskMakeupLinkService {

    // 90-day hard cap, enforced server-side regardless of what a client requests.
    static final int MAX_LOOKBACK_DAYS = 90;
    private static final int DEFAULT_PAGE_DATE_GROUPS = 10;
    private static final int MAX_PAGE_DATE_GROUPS = 30;

    private static final String STATE_ACTIONABLE = "ACTIONABLE";
    private static final String STATE_LINKED = "LINKED";
    private static final String STATE_WAITING_ON_SECOND = "WAITING_ON_SECOND";

    private final TaskRepository taskRepository;
    private final TaskResponseEntryRepository taskResponseEntryRepository;
    private final TaskMakeupLinkRepository taskMakeupLinkRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreRepository storeRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;
    private final UserRepository userRepository;
    private final UserProfileService userProfileService;
    private final NotificationService notificationService;

    public TaskMakeupLinkService(
        TaskRepository taskRepository,
        TaskResponseEntryRepository taskResponseEntryRepository,
        TaskMakeupLinkRepository taskMakeupLinkRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreRepository storeRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        UserRepository userRepository,
        UserProfileService userProfileService,
        NotificationService notificationService
    ) {
        this.taskRepository = taskRepository;
        this.taskResponseEntryRepository = taskResponseEntryRepository;
        this.taskMakeupLinkRepository = taskMakeupLinkRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeRepository = storeRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.userRepository = userRepository;
        this.userProfileService = userProfileService;
        this.notificationService = notificationService;
    }

    // Lazy expiry: a PENDING link whose target day (linked_date) has already passed
    // unfulfilled returns its missed instance to the missed list instead of silently
    // staying "Linked to today" forever. Called before every link read/write below,
    // and directly by the nightly sweep / its /internal/jobs/* twin
    // (InternalJobController.nightlyMaintenance).
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void expireStalePendingLinks() {
        taskMakeupLinkRepository.expireStalePending(LocalDate.now(), OffsetDateTime.now());
    }

    // Not readOnly: expireStalePendingLinks() below is a write (a self-invocation, so
    // it runs inside THIS method's transaction rather than one of its own -- readOnly
    // here would mark that same transaction read-only and could reject the UPDATE).
    @Transactional
    public MissedTasksPageResponse getMissedTasks(Long employeeUserId, Long storeId, String cursor, Integer limit) {
        userProfileService.requireAssignedStore(employeeUserId, storeId);
        expireStalePendingLinks();

        int pageSize = limit == null ? DEFAULT_PAGE_DATE_GROUPS : Math.min(Math.max(limit, 1), MAX_PAGE_DATE_GROUPS);
        LocalDate before = parseCursor(cursor);

        StoreOwner storeOwner = storeOwnerRepository.findByStoreId(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        Long ownerId = storeOwner.resolveTaskOwnerId();
        if (ownerId == null) {
            return new MissedTasksPageResponse(List.of(), null, 0);
        }

        LocalDate today = LocalDate.now();
        LocalDate cutoff = today.minusDays(MAX_LOOKBACK_DAYS);
        LocalDate lastMissableDay = today.minusDays(1);
        if (lastMissableDay.isBefore(cutoff)) {
            return new MissedTasksPageResponse(List.of(), null, 0);
        }

        List<Task> candidateTasks = taskRepository.findForStoreAndDateRange(ownerId, storeId, cutoff, lastMissableDay);
        if (candidateTasks.isEmpty()) {
            return new MissedTasksPageResponse(List.of(), null, 0);
        }
        List<Long> taskIds = candidateTasks.stream().map(Task::getId).toList();

        Map<TaskDateKey, Set<Long>> respondersByTaskDate = new HashMap<>();
        for (TaskResponseEntry entry : taskResponseEntryRepository
            .findByTaskIdInAndStoreIdAndResponseDateBetweenAndActiveTrue(taskIds, storeId, cutoff, lastMissableDay)) {
            respondersByTaskDate
                .computeIfAbsent(new TaskDateKey(entry.getTask().getId(), entry.getResponseDate()), key -> new HashSet<>())
                .add(entry.getEmployee().getId());
        }

        List<TaskMakeupLink> pendingLinks = taskMakeupLinkRepository
            .findByTaskIdInAndStoreIdAndStatus(taskIds, storeId, MakeupLinkStatus.PENDING);
        Map<TaskDateKey, TaskMakeupLink> pendingByTaskPastDate = pendingLinks.stream()
            .collect(Collectors.toMap(l -> new TaskDateKey(l.getTask().getId(), l.getPastDate()), l -> l));

        Map<Long, Set<Long>> todayRespondersByTask = new HashMap<>();
        for (TaskResponseEntry entry : taskResponseEntryRepository
            .findByTaskIdInAndStoreIdAndResponseDateAndActiveTrue(taskIds, storeId, today)) {
            todayRespondersByTask.computeIfAbsent(entry.getTask().getId(), key -> new HashSet<>()).add(entry.getEmployee().getId());
        }

        int totalActiveEmployees = storeEmployeeRepository.countByStoresIdAndEmployeeActiveTrue(storeId);

        // TreeMap with a reverse comparator keeps every date bucket in descending order
        // as instances are appended, task-by-task -- candidateTasks already arrives
        // sorted by category/task display order, so each date's list ends up correctly
        // ordered too, with no extra sort needed.
        TreeMap<LocalDate, List<MissedTaskInstanceResponse>> instancesByDate = new TreeMap<>(Collections.reverseOrder());

        for (Task task : candidateTasks) {
            LocalDate taskStart = task.getStartDate().isAfter(cutoff) ? task.getStartDate() : cutoff;
            LocalDate taskEnd = task.getEndDate() != null && task.getEndDate().isBefore(lastMissableDay)
                ? task.getEndDate() : lastMissableDay;
            for (LocalDate date = taskStart; !date.isAfter(taskEnd); date = date.plusDays(1)) {
                if (!TaskScheduleMatcher.matches(task, date)) {
                    continue;
                }
                Set<Long> responders = respondersByTaskDate.getOrDefault(new TaskDateKey(task.getId(), date), Set.of());
                if (task.getCompletionType().isSatisfiedBy(responders.size())) {
                    continue;
                }

                TaskMakeupLink pendingLink = pendingByTaskPastDate.get(new TaskDateKey(task.getId(), date));
                String state;
                if (pendingLink != null) {
                    state = STATE_LINKED;
                } else if (task.getCompletionType() == CompletionType.MULTIPLE
                    && responders.size() == 1 && responders.contains(employeeUserId)) {
                    state = STATE_WAITING_ON_SECOND;
                } else {
                    state = STATE_ACTIONABLE;
                }

                boolean canCompleteWithToday = pendingLink == null
                    && isScheduledTodayAndActive(task, today)
                    && !task.getCompletionType().isSatisfiedBy(todayRespondersByTask.getOrDefault(task.getId(), Set.of()).size());

                instancesByDate.computeIfAbsent(date, key -> new ArrayList<>()).add(new MissedTaskInstanceResponse(
                    task.getId(), task.getName(), task.getDescription(), task.getResponseType(), task.getResponseNote(),
                    task.getNumericUnit(), task.getNumericMin(), task.getNumericMax(), task.getTextMaxLength(),
                    task.getCompletionType(), date, state, responders.size(), totalActiveEmployees,
                    canCompleteWithToday,
                    pendingLink != null && pendingLink.getCreatedBy().getId().equals(employeeUserId),
                    pendingLink != null ? pendingLink.getLinkedDate() : null
                ));
            }
        }

        List<LocalDate> pageDates = instancesByDate.keySet().stream()
            .filter(date -> before == null || date.isBefore(before))
            .limit(pageSize)
            .toList();

        List<MissedTaskDateGroupResponse> groups = pageDates.stream()
            .map(date -> new MissedTaskDateGroupResponse(date, instancesByDate.get(date)))
            .toList();

        boolean hasMore = !pageDates.isEmpty()
            && instancesByDate.keySet().stream().anyMatch(date -> date.isBefore(pageDates.get(pageDates.size() - 1)));
        String nextCursor = hasMore ? pageDates.get(pageDates.size() - 1).toString() : null;

        int totalInstances = instancesByDate.values().stream().mapToInt(List::size).sum();
        return new MissedTasksPageResponse(groups, nextCursor, totalInstances);
    }

    @Transactional
    public MissedTaskLinkResponse linkToToday(Long employeeUserId, Long taskId, Long storeId, LocalDate pastDate) {
        userProfileService.requireAssignedStore(employeeUserId, storeId);
        expireStalePendingLinks();

        LocalDate today = LocalDate.now();
        Task task = requireMissableTask(taskId, storeId, pastDate, today);

        boolean hasActiveResponse = !taskResponseEntryRepository
            .findByTaskIdAndStoreIdAndResponseDateAndActiveTrue(taskId, storeId, pastDate).isEmpty();
        if (hasActiveResponse) {
            throw new TaskMakeupLinkNotEligibleException("This task has already been completed for that day");
        }

        if (!isScheduledTodayAndActive(task, today)) {
            throw new TaskMakeupLinkNotEligibleException("This task is not on today's checklist");
        }
        long todayResponders = taskResponseEntryRepository
            .findByTaskIdAndStoreIdAndResponseDateAndActiveTrue(taskId, storeId, today)
            .stream().map(entry -> entry.getEmployee().getId()).distinct().count();
        if (task.getCompletionType().isSatisfiedBy(todayResponders)) {
            throw new TaskMakeupLinkNotEligibleException("Today's task has already been completed");
        }

        TaskMakeupLink link = new TaskMakeupLink();
        link.setTask(task);
        link.setStore(storeRepository.getReferenceById(storeId));
        link.setPastDate(pastDate);
        link.setLinkedDate(today);
        link.setCreatedBy(userRepository.getReferenceById(employeeUserId));
        link.setStatus(MakeupLinkStatus.PENDING);

        try {
            taskMakeupLinkRepository.save(link);
            taskMakeupLinkRepository.flush();
        } catch (DataIntegrityViolationException ex) {
            throw new TaskMakeupLinkNotEligibleException("This missed task is already linked to today");
        }

        return new MissedTaskLinkResponse(task.getId(), pastDate, today, link.getStatus().name());
    }

    @Transactional
    public void unlink(Long employeeUserId, Long taskId, Long storeId, LocalDate pastDate) {
        userProfileService.requireAssignedStore(employeeUserId, storeId);
        expireStalePendingLinks();

        TaskMakeupLink link = taskMakeupLinkRepository
            .findByTaskIdAndStoreIdAndPastDateAndStatus(taskId, storeId, pastDate, MakeupLinkStatus.PENDING)
            .orElseThrow(() -> new TaskMakeupLinkNotFoundException("No pending link found for this task"));

        if (!link.getCreatedBy().getId().equals(employeeUserId)) {
            throw new UnauthorizedTaskResponseActionException("Only the employee who linked this task can remove the link");
        }

        link.setStatus(MakeupLinkStatus.CANCELLED);
        link.setResolvedAt(OffsetDateTime.now());
        link.setResolvedBy(userRepository.getReferenceById(employeeUserId));
        taskMakeupLinkRepository.save(link);
    }

    // Invariant: a missed instance has either an active response or a PENDING link,
    // never both. Called by TaskService.completeMissedNow right after a direct
    // response lands on (task, pastDate) via Complete Now.
    @Transactional
    public void cancelPendingLinkIfAny(Long taskId, Long storeId, LocalDate pastDate) {
        taskMakeupLinkRepository.findByTaskIdAndStoreIdAndPastDateAndStatus(taskId, storeId, pastDate, MakeupLinkStatus.PENDING)
            .ifPresent(link -> {
                link.setStatus(MakeupLinkStatus.CANCELLED);
                link.setResolvedAt(OffsetDateTime.now());
                taskMakeupLinkRepository.save(link);
            });
    }

    // Called from TaskService.submitResponse inside the same transaction that just
    // completed today's instance for `todayEntry`'s task/store -- fulfils every PENDING
    // link whose linked_date is today, inserting one LINK_FULFILLED response per linked
    // past date, copying the value the fulfilling employee just submitted for today.
    // A no-op (and cheap: one indexed lookup) for the common case of a task with no
    // pending links, and for a MULTIPLE task whose 1st (not yet satisfying) responder
    // triggered this call.
    @Transactional
    public void fulfillPendingLinksIfCompleted(TaskResponseEntry todayEntry) {
        Task task = todayEntry.getTask();
        Long storeId = todayEntry.getStore().getId();
        LocalDate today = todayEntry.getResponseDate();

        long distinctResponders = taskResponseEntryRepository
            .findByTaskIdAndStoreIdAndResponseDateAndActiveTrue(task.getId(), storeId, today)
            .stream().map(entry -> entry.getEmployee().getId()).distinct().count();
        if (!task.getCompletionType().isSatisfiedBy(distinctResponders)) {
            return;
        }

        List<TaskMakeupLink> pendingLinks = taskMakeupLinkRepository
            .lockPendingForFulfillment(task.getId(), storeId, today);
        if (pendingLinks.isEmpty()) {
            return;
        }

        for (TaskMakeupLink link : pendingLinks) {
            link.setStatus(MakeupLinkStatus.FULFILLED);
            link.setResolvedAt(OffsetDateTime.now());
            link.setResolvedBy(todayEntry.getEmployee());
            taskMakeupLinkRepository.save(link);

            TaskResponseEntry makeup = new TaskResponseEntry();
            makeup.setTask(task);
            makeup.setStore(todayEntry.getStore());
            makeup.setEmployee(todayEntry.getEmployee());
            makeup.setResponseDate(link.getPastDate());
            makeup.setResponseType(task.getResponseType());
            makeup.setCompletionType(task.getCompletionType());
            makeup.setValueBoolean(todayEntry.getValueBoolean());
            makeup.setValueNumeric(todayEntry.getValueNumeric());
            makeup.setValueText(todayEntry.getValueText());
            makeup.setCompletedVia(CompletedVia.LINK_FULFILLED);
            taskResponseEntryRepository.save(makeup);

            notificationService.send(link.getCreatedBy(), "TASK_MAKEUP_FULFILLED",
                "Missed task completed: " + task.getName(),
                "Your linked missed task from " + link.getPastDate() + " was completed via today's checklist.",
                "/checklist");
        }
        taskResponseEntryRepository.flush();
    }

    // Every task/store pair with at least one PENDING link whose linked_date is today,
    // for the live checklist's "Will also complete N missed (dates)" card -- batched
    // for an entire checklist read, one query instead of one per task.
    @Transactional(readOnly = true)
    public Map<Long, List<LocalDate>> findPendingMakeupDatesByTaskId(Collection<Long> taskIds, Long storeId, LocalDate today) {
        if (taskIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<LocalDate>> result = new HashMap<>();
        for (TaskMakeupLink link : taskMakeupLinkRepository.findByTaskIdInAndStoreIdAndStatus(taskIds, storeId, MakeupLinkStatus.PENDING)) {
            if (link.getLinkedDate().equals(today)) {
                result.computeIfAbsent(link.getTask().getId(), key -> new ArrayList<>()).add(link.getPastDate());
            }
        }
        return result;
    }

    private boolean isScheduledTodayAndActive(Task task, LocalDate today) {
        return task.isActive() && task.getCategory().isActive()
            && !task.getStartDate().isAfter(today)
            && (task.getEndDate() == null || !task.getEndDate().isBefore(today))
            && TaskScheduleMatcher.matches(task, today);
    }

    // Re-validates that (taskId, storeId, pastDate) is still a genuine missed-instance
    // candidate: task exists and applies to this store (ignoring its CURRENT active
    // flag, same reasoning as TaskRepository.findForStoreAndDateRange), pastDate is a
    // real past day within the 90-day cap and within the task's own start/end range.
    // Shared by linkToToday here and TaskService.completeMissedNow (duplicated there in
    // miniature rather than shared via a cross-service call, to avoid a circular
    // dependency between TaskService and this service).
    private Task requireMissableTask(Long taskId, Long storeId, LocalDate pastDate, LocalDate today) {
        if (!pastDate.isBefore(today) || pastDate.isBefore(today.minusDays(MAX_LOOKBACK_DAYS))) {
            throw new TaskNotFoundException("This task instance is not available");
        }
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new TaskNotFoundException("Task not found"));
        boolean appliesToStore = task.isAppliesToAllStores()
            || task.getStores().stream().anyMatch(store -> store.getId().equals(storeId));
        if (!appliesToStore) {
            throw new TaskNotFoundException("Task not found");
        }
        if (pastDate.isBefore(task.getStartDate()) || (task.getEndDate() != null && pastDate.isAfter(task.getEndDate()))) {
            throw new TaskNotFoundException("This task instance is not available");
        }
        return task;
    }

    private static LocalDate parseCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(cursor);
        } catch (java.time.format.DateTimeParseException ex) {
            throw new IllegalArgumentException("Invalid cursor");
        }
    }

    private record TaskDateKey(Long taskId, LocalDate date) {
    }
}
