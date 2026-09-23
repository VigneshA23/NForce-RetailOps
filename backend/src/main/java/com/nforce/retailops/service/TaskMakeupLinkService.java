package com.nforce.retailops.service;

import com.nforce.retailops.dto.MissedTaskDateGroupResponse;
import com.nforce.retailops.dto.MissedTaskInstanceResponse;
import com.nforce.retailops.dto.MissedTaskMoveResponse;
import com.nforce.retailops.dto.MissedTasksPageResponse;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.MakeupLinkStatus;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskMakeupLink;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.exception.TaskMakeupLinkNotEligibleException;
import com.nforce.retailops.exception.TaskNotFoundException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.TaskMakeupLinkRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import com.nforce.retailops.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * "Missed Tasks" / "Move missed task instance to a day": lets any employee move a past-day
 * task instance that was never answered (a "missed instance") onto a target date (today,
 * up to 7 days out). The moved instance then renders on the target date's checklist as its
 * own independent completion unit (see TaskService.getTodayChecklistForEmployee), completed
 * through the normal checklist submit flow -- there is no copying/auto-fulfillment fan-out
 * and no direct completion from this page.
 *
 * A missed instance is defined the same way "is this task/day Completed" is determined
 * everywhere else in the app (CompletionType.isSatisfiedBy on distinct active
 * responders), NOT merely "zero responses" -- so a MULTIPLE task with exactly one
 * responder still shows as missed (state WAITING_ON_SECOND for that responder, still
 * ACTIONABLE for anyone else), matching the live checklist's own "X/Y responded" rule.
 */
@Service
public class TaskMakeupLinkService {

    private static final Logger log = LoggerFactory.getLogger(TaskMakeupLinkService.class);

    // Hard cap, enforced server-side regardless of what a client requests: a missed
    // instance older than this never appears on the missed-tasks list. Measured from
    // the instance's original due date, not from when a move (if any) targets it.
    static final int MAX_LOOKBACK_DAYS = 7;

    // Interim cap on how far into the future a move's target date may be.
    private static final int MAX_MOVE_DAYS_AHEAD = 7;

    private static final int DEFAULT_PAGE_DATE_GROUPS = 10;
    private static final int MAX_PAGE_DATE_GROUPS = 30;

    private static final String STATE_ACTIONABLE = "ACTIONABLE";
    private static final String STATE_WAITING_ON_SECOND = "WAITING_ON_SECOND";

    private final TaskRepository taskRepository;
    private final TaskResponseEntryRepository taskResponseEntryRepository;
    private final TaskMakeupLinkRepository taskMakeupLinkRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreRepository storeRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;
    private final UserRepository userRepository;
    private final UserProfileService userProfileService;

    public TaskMakeupLinkService(
        TaskRepository taskRepository,
        TaskResponseEntryRepository taskResponseEntryRepository,
        TaskMakeupLinkRepository taskMakeupLinkRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreRepository storeRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        UserRepository userRepository,
        UserProfileService userProfileService
    ) {
        this.taskRepository = taskRepository;
        this.taskResponseEntryRepository = taskResponseEntryRepository;
        this.taskMakeupLinkRepository = taskMakeupLinkRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeRepository = storeRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.userRepository = userRepository;
        this.userProfileService = userProfileService;
    }

    // Lazy expiry: a PENDING move whose target day (linked_date) has already passed
    // unfulfilled returns its missed instance to the missed list instead of silently
    // staying pending forever. Called before every move read/write below, and directly
    // by the nightly sweep / its /internal/jobs/* twin (InternalJobController.nightlyMaintenance).
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void expireStalePendingMoves() {
        taskMakeupLinkRepository.expireStalePending(LocalDate.now(), OffsetDateTime.now());
    }

    // Not readOnly: expireStalePendingMoves() below is a write (a self-invocation, so
    // it runs inside THIS method's transaction rather than one of its own -- readOnly
    // here would mark that same transaction read-only and could reject the UPDATE).
    @Transactional
    public MissedTasksPageResponse getMissedTasks(Long employeeUserId, Long storeId, String cursor, Integer limit) {
        // Diagnostic timing: each timed() call brackets exactly one round trip to the
        // database (request sent -> response received). Anything NOT inside a timed()
        // call -- the per-day matching loop, DTO construction -- is local, in-process
        // computation, not a DB wait. Compare the sum of the DB lines below against
        // "TOTAL" to see how much of a slow request is the database vs. this server.
        long overallStart = System.nanoTime();
        log.info("[MissedTasks] START employeeUserId={} storeId={}", employeeUserId, storeId);

        timed("userProfileService.requireAssignedStore", () -> {
            userProfileService.requireAssignedStore(employeeUserId, storeId);
            return null;
        });
        timed("expireStalePendingMoves", () -> {
            expireStalePendingMoves();
            return null;
        });

        int pageSize = limit == null ? DEFAULT_PAGE_DATE_GROUPS : Math.min(Math.max(limit, 1), MAX_PAGE_DATE_GROUPS);
        LocalDate before = parseCursor(cursor);

        StoreOwner storeOwner = timed("storeOwnerRepository.findByStoreId",
            () -> storeOwnerRepository.findByStoreId(storeId))
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        Long ownerId = storeOwner.resolveTaskOwnerId();
        if (ownerId == null) {
            log.info("[MissedTasks] TOTAL {} ms (no task owner)", elapsedMs(overallStart));
            return new MissedTasksPageResponse(List.of(), null, 0);
        }

        LocalDate today = LocalDate.now();
        LocalDate cutoff = today.minusDays(MAX_LOOKBACK_DAYS);
        LocalDate lastMissableDay = today.minusDays(1);
        if (lastMissableDay.isBefore(cutoff)) {
            log.info("[MissedTasks] TOTAL {} ms (store younger than lookback window)", elapsedMs(overallStart));
            return new MissedTasksPageResponse(List.of(), null, 0);
        }

        List<Task> candidateTasks = timed("taskRepository.findForStoreAndDateRange",
            () -> taskRepository.findForStoreAndDateRange(ownerId, storeId, cutoff, lastMissableDay));
        log.info("[MissedTasks] candidateTasks={}", candidateTasks.size());
        if (candidateTasks.isEmpty()) {
            log.info("[MissedTasks] TOTAL {} ms (no candidate tasks)", elapsedMs(overallStart));
            return new MissedTasksPageResponse(List.of(), null, 0);
        }
        List<Long> taskIds = candidateTasks.stream().map(Task::getId).toList();

        List<TaskResponseEntry> pastResponses = timed(
            "taskResponseEntryRepository.findByTaskIdInAndStoreIdAndResponseDateBetweenAndActiveTrue",
            () -> taskResponseEntryRepository
                .findByTaskIdInAndStoreIdAndResponseDateBetweenAndActiveTrue(taskIds, storeId, cutoff, lastMissableDay));
        log.info("[MissedTasks] pastResponses={}", pastResponses.size());
        Map<TaskDateKey, Set<Long>> respondersByTaskDate = new HashMap<>();
        for (TaskResponseEntry entry : pastResponses) {
            respondersByTaskDate
                .computeIfAbsent(new TaskDateKey(entry.getTask().getId(), entry.getResponseDate()), key -> new HashSet<>())
                .add(entry.getEmployee().getId());
        }

        List<TaskMakeupLink> pendingMoves = timed("taskMakeupLinkRepository.findByTaskIdInAndStoreIdAndStatus",
            () -> taskMakeupLinkRepository.findByTaskIdInAndStoreIdAndStatus(taskIds, storeId, MakeupLinkStatus.PENDING));
        Map<TaskDateKey, TaskMakeupLink> pendingByTaskPastDate = pendingMoves.stream()
            .collect(Collectors.toMap(l -> new TaskDateKey(l.getTask().getId(), l.getPastDate()), l -> l));

        int totalActiveEmployees = timed("storeEmployeeRepository.countByStoresIdAndEmployeeActiveTrue",
            () -> storeEmployeeRepository.countByStoresIdAndEmployeeActiveTrue(storeId));

        // TreeMap with a reverse comparator keeps every date bucket in descending order
        // as instances are appended, task-by-task -- candidateTasks already arrives
        // sorted by category/task display order, so each date's list ends up correctly
        // ordered too, with no extra sort needed.
        TreeMap<LocalDate, List<MissedTaskInstanceResponse>> instancesByDate = new TreeMap<>(Collections.reverseOrder());

        long loopStart = System.nanoTime();
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

                // A pending move excludes the instance from the missed list entirely --
                // it's no longer actionable here, it reappears on its target date's
                // checklist instead (TaskService.getTodayChecklistForEmployee).
                if (pendingByTaskPastDate.containsKey(new TaskDateKey(task.getId(), date))) {
                    continue;
                }

                String state;
                if (task.getCompletionType() == CompletionType.MULTIPLE
                    && responders.size() == 1 && responders.contains(employeeUserId)) {
                    state = STATE_WAITING_ON_SECOND;
                } else {
                    state = STATE_ACTIONABLE;
                }

                instancesByDate.computeIfAbsent(date, key -> new ArrayList<>()).add(new MissedTaskInstanceResponse(
                    task.getId(), task.getName(), task.getCategory().getName(), task.getDescription(),
                    task.getResponseType(), task.getResponseNote(),
                    task.getNumericUnit(), task.getNumericMin(), task.getNumericMax(), task.getTextMaxLength(),
                    task.getCompletionType(),
                    task.getScheduleType(), task.getSelectedDays().stream().sorted().toList(),
                    task.getStartDate(), task.getEndDate(),
                    date, state, responders.size(), totalActiveEmployees
                ));
            }
        }
        log.info("[MissedTasks] in-memory day-matching loop (LOCAL, no DB) took {} ms", elapsedMs(loopStart));

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
        log.info("[MissedTasks] TOTAL {} ms (request received -> response ready, DB + local combined)", elapsedMs(overallStart));
        return new MissedTasksPageResponse(groups, nextCursor, totalInstances);
    }

    // Brackets exactly one DB round trip: request sent -> response received. Every
    // repository call in getMissedTasks is wrapped in this so the log makes it
    // unambiguous which lines are "waiting on the database" vs. everything else
    // (in-process Java, no network/DB involved).
    private <T> T timed(String label, Supplier<T> query) {
        long start = System.nanoTime();
        log.info("[MissedTasks] -> sending to DB: {}", label);
        T result = query.get();
        log.info("[MissedTasks] <- received from DB: {} ({} ms)", label, elapsedMs(start));
        return result;
    }

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }

    // Creates a PENDING move of a missed instance (taskId, storeId, originalDueDate)
    // onto targetDate (today..+MAX_MOVE_DAYS_AHEAD). The instance disappears from the
    // missed list immediately (getMissedTasks skips any instance with a PENDING move);
    // it reappears on targetDate's checklist as its own independent unit
    // (TaskService.getTodayChecklistForEmployee) until completed, undone, or the move
    // expires. task.active is deliberately ignored -- a moved unit's eligibility never
    // depends on the task's current configuration.
    @Transactional
    public MissedTaskMoveResponse moveToDate(Long employeeUserId, Long taskId, Long storeId, LocalDate originalDueDate, LocalDate targetDate) {
        userProfileService.requireAssignedStore(employeeUserId, storeId);
        expireStalePendingMoves();

        LocalDate today = LocalDate.now();
        if (targetDate.isBefore(today) || targetDate.isAfter(today.plusDays(MAX_MOVE_DAYS_AHEAD))) {
            throw new TaskMakeupLinkNotEligibleException(
                "Choose a date between today and " + MAX_MOVE_DAYS_AHEAD + " days from now");
        }
        Task task = requireMissableTask(taskId, storeId, originalDueDate, today);

        boolean hasActiveResponse = !taskResponseEntryRepository
            .findByTaskIdAndStoreIdAndResponseDateAndActiveTrue(taskId, storeId, originalDueDate).isEmpty();
        if (hasActiveResponse) {
            throw new TaskMakeupLinkNotEligibleException("This task has already been completed for that day");
        }

        TaskMakeupLink move = new TaskMakeupLink();
        move.setTask(task);
        move.setStore(storeRepository.getReferenceById(storeId));
        move.setPastDate(originalDueDate);
        move.setLinkedDate(targetDate);
        move.setCreatedBy(userRepository.getReferenceById(employeeUserId));
        move.setStatus(MakeupLinkStatus.PENDING);

        try {
            taskMakeupLinkRepository.save(move);
            taskMakeupLinkRepository.flush();
        } catch (DataIntegrityViolationException ex) {
            throw new TaskMakeupLinkNotEligibleException("This task is already moved to another date");
        }

        return new MissedTaskMoveResponse(task.getId(), originalDueDate, targetDate, move.getStatus().name());
    }

    // Invariant: a missed instance has either an active response or a PENDING move,
    // never both. Called unconditionally from TaskService.writeResponse right after
    // any TaskResponseEntry is saved for (taskId, storeId, date) -- a no-op (one
    // indexed UPDATE matching zero rows) for the common case of no pending move.
    // Sets status to FULFILLED (never CANCELLED -- CANCELLED is reserved for task
    // hard-delete orphan cleanup).
    @Transactional
    public void terminatePendingMoveIfAny(Long taskId, Long storeId, LocalDate originalDueDate, Long resolvedByUserId) {
        taskMakeupLinkRepository.terminatePendingMove(
            taskId, storeId, originalDueDate, OffsetDateTime.now(), userRepository.getReferenceById(resolvedByUserId));
    }

    // Checklist read: every moved unit (PENDING or FULFILLED) targeting one date for a
    // store. FULFILLED rows must be included, not just PENDING -- otherwise a MULTIPLE
    // moved unit would vanish the instant the first of two distinct responders answers
    // it (terminating the move), even though the second responder still needs to see
    // and answer it; and a completed moved unit needs to keep rendering with its
    // "Done"/Undo state, not disappear. TaskService.getTodayChecklistForEmployee
    // additionally filters out any FULFILLED row whose response has since been undone.
    @Transactional(readOnly = true)
    public List<TaskMakeupLink> findMovedUnitsTargetingDate(Long storeId, LocalDate targetDate) {
        return taskMakeupLinkRepository.findByStoreIdAndLinkedDateAndStatusIn(
            storeId, targetDate, List.of(MakeupLinkStatus.PENDING, MakeupLinkStatus.FULFILLED));
    }

    // Guards a moved-unit submission (TaskService.submitResponse): the instance must
    // have a move (PENDING, or already FULFILLED by an earlier responder/resubmission)
    // targeting the day being submitted on -- otherwise the move has expired/never
    // existed, and the submission is rejected rather than silently creating an orphaned
    // response. FULFILLED must count too: a MULTIPLE moved unit's move already went
    // FULFILLED the moment the first of two distinct responders answered it, but the
    // second responder still needs to submit; same for a flag -> resubmit cycle on an
    // already-completed moved unit.
    @Transactional(readOnly = true)
    public void requireMoveTargeting(Long taskId, Long storeId, LocalDate originalDueDate, LocalDate targetDate) {
        boolean exists = taskMakeupLinkRepository
            .findByTaskIdAndStoreIdAndPastDateAndStatusIn(
                taskId, storeId, originalDueDate, List.of(MakeupLinkStatus.PENDING, MakeupLinkStatus.FULFILLED))
            .stream()
            .anyMatch(move -> move.getLinkedDate().equals(targetDate));
        if (!exists) {
            throw new TaskMakeupLinkNotEligibleException("This moved task is no longer available");
        }
    }

    // Re-validates that (taskId, storeId, pastDate) is still a genuine missed-instance
    // candidate: task exists and applies to this store (ignoring its CURRENT active
    // flag, same reasoning as TaskRepository.findForStoreAndDateRange), pastDate is a
    // real past day within the MAX_LOOKBACK_DAYS cap and within the task's own start/end range.
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
