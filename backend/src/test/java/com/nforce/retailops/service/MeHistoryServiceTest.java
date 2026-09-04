package com.nforce.retailops.service;

import com.nforce.retailops.dto.ChecklistHistoryDetailResponse;
import com.nforce.retailops.dto.HistoryResponseEntryResponse;
import com.nforce.retailops.dto.HistoryTaskItemResponse;
import com.nforce.retailops.dto.TaskResponseSubmitRequest;
import com.nforce.retailops.dto.TodayChecklistResponse;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.IssueStatus;
import com.nforce.retailops.entity.RaisedIssue;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.RaisedIssueRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Exercises MeHistoryService (the employee-facing checklist history read
 * model) against a real (H2, Postgres-compatible) database, the same way
 * TaskResponsePersistenceTest proves TaskService's employee-facing flows.
 */
@SpringBootTest
@ActiveProfiles("test")
class MeHistoryServiceTest {

    @Autowired
    private MeHistoryService meHistoryService;
    @Autowired
    private TaskService taskService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CategoryRepository categoryRepository;
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private StoreRepository storeRepository;
    @Autowired
    private StoreOwnerRepository storeOwnerRepository;
    @Autowired
    private StoreEmployeeRepository storeEmployeeRepository;
    @Autowired
    private TaskResponseEntryRepository taskResponseEntryRepository;
    @Autowired
    private RaisedIssueRepository raisedIssueRepository;

    private Long ownerId;
    private Long categoryId;
    private Long storeId;
    private Long employeeId;

    @BeforeEach
    @Transactional
    void setUp() {
        User owner = saveUser("history-owner");
        ownerId = owner.getId();

        Category category = new Category();
        category.setOwner(owner);
        category.setName("Opening");
        category.setDisplayOrder(0);
        category = categoryRepository.save(category);
        categoryId = category.getId();

        Store store = saveStore(91001L + System.nanoTime() % 1000);
        storeId = store.getId();
        linkOwnerToStore(owner, store);

        User employee = saveUser("history-employee");
        employeeId = employee.getId();
        saveStoreEmployee(employee, owner, store);
    }

    private User saveUser(String prefix) {
        User user = new User();
        user.setEmail(prefix + "-" + System.nanoTime() + "@nforce.test");
        user.setPasswordHash("irrelevant-hash");
        user.setFullName("Test " + prefix);
        return userRepository.save(user);
    }

    private Store saveStore(long storeCode) {
        Store store = new Store();
        store.setName("Test Store");
        store.setStoreCode(storeCode);
        store.setActive(true);
        return storeRepository.save(store);
    }

    private void linkOwnerToStore(User owner, Store store) {
        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store);
        storeOwner.setOwner(owner);
        storeOwnerRepository.save(storeOwner);
    }

    private void saveStoreEmployee(User employee, User owner, Store... stores) {
        StoreEmployee storeEmployee = new StoreEmployee();
        storeEmployee.setEmployee(employee);
        storeEmployee.setCreatedByOwner(owner);
        storeEmployee.setPhone("555-0100");
        storeEmployee.setShift("Morning");
        storeEmployee.setEmployeeType("Full Time");
        storeEmployee.setGender("Female");
        storeEmployee.setStores(new HashSet<>(Set.of(stores)));
        storeEmployeeRepository.save(storeEmployee);
    }

    private Task saveTask(Store store) {
        return saveTask(store, LocalDate.now().minusDays(1));
    }

    private Task saveTask(Store store, LocalDate startDate) {
        Task task = new Task();
        task.setOwner(userRepository.getReferenceById(ownerId));
        task.setCategory(categoryRepository.getReferenceById(categoryId));
        task.setName("Unlock front door");
        task.setDisplayOrder(0);
        task.setAppliesToAllStores(false);
        task.getStores().add(store);
        task.setResponseType(ResponseType.YES_NO);
        task.setCompletionType(CompletionType.SINGLE);
        task.setScheduleType(ScheduleType.EVERY_DAY);
        task.setTimeMode(TimeMode.ANYTIME);
        task.setStartDate(startDate);
        task.setActive(true);
        return taskRepository.save(task);
    }

    private void saveResponse(Task task, Store store, User employee, LocalDate date, boolean value) {
        saveResponse(task, store, employee, date, value, CompletionType.SINGLE);
    }

    // completionType must match the task's own (denormalized) completion type
    // whenever a test plants more than one active response for the same
    // (task, store, date) -- the SINGLE-only partial unique index (V19) rejects
    // a second SINGLE row there even across different employees.
    private void saveResponse(
        Task task, Store store, User employee, LocalDate date, boolean value, CompletionType completionType
    ) {
        TaskResponseEntry entry = new TaskResponseEntry();
        entry.setTask(task);
        entry.setStore(store);
        entry.setEmployee(employee);
        entry.setResponseDate(date);
        entry.setResponseType(ResponseType.YES_NO);
        entry.setCompletionType(completionType);
        entry.setValueBoolean(value);
        entry.setActive(true);
        taskResponseEntryRepository.save(entry);
    }

    // 1. Assigned store, with a real task + response for the day: the categorized
    // detail matches the same shape ChecklistHistoryService's owner-facing detail
    // produces, enriched with the responding employee's empId.
    @Test
    @Transactional
    void detailReturnsCategorizedChecklistForAssignedStore() {
        Store store = storeRepository.getReferenceById(storeId);
        User employee = userRepository.getReferenceById(employeeId);
        Task task = saveTask(store);
        LocalDate today = LocalDate.now();
        saveResponse(task, store, employee, today, true);

        ChecklistHistoryDetailResponse detail = meHistoryService.getDetail(employeeId, storeId, today);

        assertThat(detail.storeId()).isEqualTo(storeId);
        assertThat(detail.hasChecklist()).isTrue();
        assertThat(detail.categories()).hasSize(1);
        assertThat(detail.categories().get(0).id()).isEqualTo(categoryId);
        // Regression check for the join-fetched Task.category query: name/displayOrder
        // grouping must still resolve correctly against a real Hibernate session.
        assertThat(detail.categories().get(0).name()).isEqualTo("Opening");

        var item = detail.categories().get(0).tasks().get(0);
        assertThat(item.id()).isEqualTo(task.getId());
        assertThat(item.completed()).isTrue();
        assertThat(item.currentlyActive()).isTrue();
        assertThat(item.responses()).hasSize(1);
        assertThat(item.responses().get(0).employeeUserId()).isEqualTo(employeeId);
        assertThat(item.responses().get(0).booleanValue()).isTrue();
        assertThat(item.responses().get(0).empId()).startsWith("EMP-");
    }

    // 2. Unauthorized store: an employee with no StoreEmployee assignment to this
    // store is masked as "store not found", the same guard TaskService's
    // employee-facing methods already rely on (requireAssignedStore).
    @Test
    @Transactional
    void detailRejectsStoreNotAssignedToEmployee() {
        User unassignedEmployee = saveUser("history-unassigned");

        assertThatThrownBy(() -> meHistoryService.getDetail(unassignedEmployee.getId(), storeId, LocalDate.now()))
            .isInstanceOf(StoreNotFoundException.class);
    }

    // 3. Assigned store, but nothing configured/recorded for the day: hasChecklist
    // is false and categories is empty, rather than an error.
    @Test
    @Transactional
    void detailReturnsEmptyHistoryWhenNothingRecorded() {
        LocalDate today = LocalDate.now();

        ChecklistHistoryDetailResponse detail = meHistoryService.getDetail(employeeId, storeId, today);

        assertThat(detail.hasChecklist()).isFalse();
        assertThat(detail.categories()).isEmpty();
    }

    // 4. History for "today" must be the exact same task set as the live Daily
    // Checklist for today -- both read paths share findActiveForStoreAndDate +
    // TaskScheduleMatcher, so this pins that parity down as an explicit contract
    // rather than relying on the two services happening to agree.
    @Test
    @Transactional
    void historyForTodayMatchesTodaysDailyChecklistTaskSet() {
        Store store = storeRepository.getReferenceById(storeId);
        saveTask(store, LocalDate.now().minusDays(1));
        saveTask(store, LocalDate.now().minusDays(1));
        LocalDate today = LocalDate.now();

        TodayChecklistResponse checklist = taskService.getTodayChecklistForEmployee(employeeId, storeId);
        Set<Long> checklistTaskIds = checklist.categories().stream()
            .flatMap(category -> category.tasks().stream())
            .map(item -> item.id())
            .collect(java.util.stream.Collectors.toSet());

        ChecklistHistoryDetailResponse history = meHistoryService.getDetail(employeeId, storeId, today);
        Set<Long> historyTaskIds = history.categories().stream()
            .flatMap(category -> category.tasks().stream())
            .map(HistoryTaskItemResponse::id)
            .collect(java.util.stream.Collectors.toSet());

        assertThat(historyTaskIds).isEqualTo(checklistTaskIds);
        assertThat(historyTaskIds).hasSize(2);
    }

    // 5. A task answered yesterday must keep showing in yesterday's History even
    // after being deactivated today -- and, symmetrically, no longer appear in
    // today's (unanswered) checklist/history once deactivated. This is the
    // "admin changes tasks today, yesterday's History keeps yesterday's
    // checklist" requirement for the one case the current schema can prove:
    // a task that was actually answered (task_responses preserves that fact
    // regardless of the task row's current state).
    @Test
    @Transactional
    void taskAnsweredYesterdayStaysInYesterdaysHistoryAfterBeingDeactivatedToday() {
        Store store = storeRepository.getReferenceById(storeId);
        User employee = userRepository.getReferenceById(employeeId);
        LocalDate yesterday = LocalDate.now().minusDays(1);
        LocalDate today = LocalDate.now();

        Task task = saveTask(store, yesterday.minusDays(1));
        saveResponse(task, store, employee, yesterday, true);

        // Admin deactivates the task "today".
        task.setActive(false);
        taskRepository.save(task);

        ChecklistHistoryDetailResponse yesterdaysHistory = meHistoryService.getDetail(employeeId, storeId, yesterday);
        assertThat(yesterdaysHistory.hasChecklist()).isTrue();
        HistoryTaskItemResponse yesterdaysItem = yesterdaysHistory.categories().get(0).tasks().get(0);
        assertThat(yesterdaysItem.id()).isEqualTo(task.getId());
        assertThat(yesterdaysItem.completed()).isTrue();
        // The task row itself has no per-date "was active on X" record -- only
        // its CURRENT active flag, which is what currentlyActive reports here.
        assertThat(yesterdaysItem.currentlyActive()).isFalse();

        ChecklistHistoryDetailResponse todaysHistory = meHistoryService.getDetail(employeeId, storeId, today);
        assertThat(todaysHistory.hasChecklist()).isFalse();
        assertThat(todaysHistory.categories()).isEmpty();
    }

    // 6. A task created today (start_date = today) must not leak into
    // yesterday's History -- future/new configuration only ever applies from
    // its own start_date forward, which findActiveForStoreAndDate already
    // enforces via a plain start_date <= :date column comparison.
    @Test
    @Transactional
    void taskCreatedTodayDoesNotAppearInYesterdaysHistory() {
        Store store = storeRepository.getReferenceById(storeId);
        LocalDate today = LocalDate.now();
        LocalDate yesterday = today.minusDays(1);
        Task task = saveTask(store, today);

        ChecklistHistoryDetailResponse yesterdaysHistory = meHistoryService.getDetail(employeeId, storeId, yesterday);
        assertThat(yesterdaysHistory.hasChecklist()).isFalse();
        assertThat(yesterdaysHistory.categories()).isEmpty();

        ChecklistHistoryDetailResponse todaysHistory = meHistoryService.getDetail(employeeId, storeId, today);
        assertThat(todaysHistory.hasChecklist()).isTrue();
        assertThat(todaysHistory.categories().get(0).tasks().get(0).id()).isEqualTo(task.getId());
    }

    // 7. Same store, same date, two employees, MULTIPLE-completion task: every
    // employee's History must show ALL employees' responses for that task, not
    // just the caller's own -- this is the core "who else completed this"
    // requirement for MULTIPLE-completion tasks.
    @Test
    @Transactional
    void historySurfacesAllEmployeesResponsesForMultipleCompletionTask() {
        Store store = storeRepository.getReferenceById(storeId);
        User employee1 = userRepository.getReferenceById(employeeId);
        User employee2 = saveUser("history-teammate");
        saveStoreEmployee(employee2, userRepository.getReferenceById(ownerId), store);

        Task task = saveTask(store);
        task.setCompletionType(CompletionType.MULTIPLE);
        taskRepository.save(task);
        LocalDate today = LocalDate.now();

        saveResponse(task, store, employee1, today, true, CompletionType.MULTIPLE);
        saveResponse(task, store, employee2, today, false, CompletionType.MULTIPLE);

        ChecklistHistoryDetailResponse employee1History = meHistoryService.getDetail(employeeId, storeId, today);
        HistoryTaskItemResponse employee1Item = employee1History.categories().get(0).tasks().get(0);
        assertThat(employee1Item.responses()).hasSize(2);
        assertThat(employee1Item.responses().stream().map(HistoryResponseEntryResponse::employeeUserId).toList())
            .containsExactlyInAnyOrder(employeeId, employee2.getId());

        ChecklistHistoryDetailResponse employee2History = meHistoryService.getDetail(employee2.getId(), storeId, today);
        HistoryTaskItemResponse employee2Item = employee2History.categories().get(0).tasks().get(0);
        assertThat(employee2Item.responses()).hasSize(2);
        assertThat(employee2Item.responses().stream().map(HistoryResponseEntryResponse::employeeUserId).toList())
            .containsExactlyInAnyOrder(employeeId, employee2.getId());
    }

    // 7b. Same store, same date, two employees, SINGLE-completion task: unchanged
    // means matching what Today's Task List already does for SINGLE tasks (it
    // doesn't filter by employeeId either) -- exactly one response ever exists
    // for a SINGLE task, and it surfaces the same way to every authorized
    // employee, not just whoever happened to submit it.
    @Test
    @Transactional
    void historyShowsTheOneResponseForSingleCompletionTaskToEveryAuthorizedEmployee() {
        Store store = storeRepository.getReferenceById(storeId);
        User employee1 = userRepository.getReferenceById(employeeId);
        User employee2 = saveUser("history-single-teammate");
        saveStoreEmployee(employee2, userRepository.getReferenceById(ownerId), store);

        Task task = saveTask(store);
        LocalDate today = LocalDate.now();
        saveResponse(task, store, employee1, today, true);

        ChecklistHistoryDetailResponse employee2History = meHistoryService.getDetail(employee2.getId(), storeId, today);
        HistoryTaskItemResponse employee2Item = employee2History.categories().get(0).tasks().get(0);
        assertThat(employee2Item.completed()).isTrue();
        assertThat(employee2Item.responses()).hasSize(1);
        assertThat(employee2Item.responses().get(0).employeeUserId()).isEqualTo(employeeId);

        ChecklistHistoryDetailResponse employee1History = meHistoryService.getDetail(employeeId, storeId, today);
        HistoryTaskItemResponse employee1Item = employee1History.categories().get(0).tasks().get(0);
        assertThat(employee1Item.completed()).isTrue();
        assertThat(employee1Item.responses()).hasSize(1);
        assertThat(employee1Item.responses().get(0).employeeUserId()).isEqualTo(employeeId);
    }

    // 8. Data isolation -- same employee, two stores, same date: selecting Store A
    // must never surface the same employee's Store B responses (a real scenario
    // for an employee assigned to multiple stores).
    @Test
    @Transactional
    void historyExcludesSameEmployeesResponsesFromOtherStore() {
        Store storeA = storeRepository.getReferenceById(storeId);
        Store storeB = saveStore(92001L + System.nanoTime() % 1000);
        linkOwnerToStore(userRepository.getReferenceById(ownerId), storeB);

        User multiStoreEmployee = saveUser("history-multi-store");
        saveStoreEmployee(multiStoreEmployee, userRepository.getReferenceById(ownerId), storeA, storeB);

        Task task = saveTask(storeA);
        task.setAppliesToAllStores(true);
        taskRepository.save(task);
        LocalDate today = LocalDate.now();

        saveResponse(task, storeA, multiStoreEmployee, today, true);
        saveResponse(task, storeB, multiStoreEmployee, today, false);

        ChecklistHistoryDetailResponse storeAHistory =
            meHistoryService.getDetail(multiStoreEmployee.getId(), storeA.getId(), today);
        assertThat(storeAHistory.storeId()).isEqualTo(storeA.getId());
        HistoryTaskItemResponse storeAItem = storeAHistory.categories().get(0).tasks().get(0);
        assertThat(storeAItem.responses()).hasSize(1);
        assertThat(storeAItem.responses().get(0).booleanValue()).isTrue();

        ChecklistHistoryDetailResponse storeBHistory =
            meHistoryService.getDetail(multiStoreEmployee.getId(), storeB.getId(), today);
        assertThat(storeBHistory.storeId()).isEqualTo(storeB.getId());
        HistoryTaskItemResponse storeBItem = storeBHistory.categories().get(0).tasks().get(0);
        assertThat(storeBItem.responses()).hasSize(1);
        assertThat(storeBItem.responses().get(0).booleanValue()).isFalse();
    }

    // 9. Data isolation -- store/date is the real boundary: with "noise" responses
    // planted on every other combination of store/employee/date, a query for one
    // exact (store, date) pair returns every response matching store+date
    // (MULTIPLE-completion, so both employee1's and employee2's responses count),
    // but excludes the other-store and other-date noise, proving the filtering
    // isn't accidentally satisfied by store or date alone.
    @Test
    @Transactional
    void historyReturnsOnlyResponsesMatchingStoreAndDateExactly() {
        Store storeA = storeRepository.getReferenceById(storeId);
        Store storeB = saveStore(93001L + System.nanoTime() % 1000);
        linkOwnerToStore(userRepository.getReferenceById(ownerId), storeB);

        User employee1 = userRepository.getReferenceById(employeeId);
        User employee2 = saveUser("history-noise-employee");
        // employee1 already has a StoreEmployee row from setUp() (one-to-one with
        // the user) -- extend its store assignment rather than inserting a second row.
        StoreEmployee employee1Assignment = storeEmployeeRepository.findByEmployeeId(employeeId).orElseThrow();
        employee1Assignment.getStores().add(storeB);
        storeEmployeeRepository.save(employee1Assignment);
        saveStoreEmployee(employee2, userRepository.getReferenceById(ownerId), storeA, storeB);

        Task task = saveTask(storeA, LocalDate.now().minusDays(2));
        task.setAppliesToAllStores(true);
        task.setCompletionType(CompletionType.MULTIPLE);
        taskRepository.save(task);

        LocalDate dateX = LocalDate.now();
        LocalDate dateY = dateX.minusDays(1);

        TaskResponseEntry target = new TaskResponseEntry();
        target.setTask(task);
        target.setStore(storeA);
        target.setEmployee(employee1);
        target.setResponseDate(dateX);
        target.setResponseType(ResponseType.YES_NO);
        target.setCompletionType(CompletionType.MULTIPLE);
        target.setValueBoolean(true);
        target.setActive(true);
        target = taskResponseEntryRepository.save(target);

        // Noise: same store + date, different employee (MULTIPLE avoids clashing
        // with `target`'s own row under the SINGLE-only partial unique index).
        saveResponse(task, storeA, employee2, dateX, true, CompletionType.MULTIPLE);
        // Noise: same employee + date, different store.
        saveResponse(task, storeB, employee1, dateX, true);
        // Noise: same store + employee, different date.
        saveResponse(task, storeA, employee1, dateY, true);

        ChecklistHistoryDetailResponse detail = meHistoryService.getDetail(employeeId, storeA.getId(), dateX);

        List<HistoryResponseEntryResponse> allResponses = detail.categories().stream()
            .flatMap(category -> category.tasks().stream())
            .flatMap(item -> item.responses().stream())
            .toList();

        // Same store + same date (employee1's target and employee2's noise) both
        // surface; different-store and different-date noise do not.
        assertThat(allResponses).hasSize(2);
        assertThat(allResponses.stream().map(HistoryResponseEntryResponse::id).toList())
            .contains(target.getId());
        assertThat(allResponses.stream().map(HistoryResponseEntryResponse::employeeUserId).toList())
            .containsExactlyInAnyOrder(employeeId, employee2.getId());
    }

    // 10. Today's History must mirror the live Daily Checklist exactly, even when
    // a task answered earlier today is deactivated later the SAME day -- the
    // historical "keep it visible" union (test 5) is a past-date-only allowance;
    // for today it would otherwise show a task /api/me/tasks/today no longer
    // does, violating "History shows only what's on today's checklist."
    @Test
    @Transactional
    void taskAnsweredEarlierTodayDisappearsFromTodaysHistoryOnceDeactivatedTheSameDay() {
        Store store = storeRepository.getReferenceById(storeId);
        User employee = userRepository.getReferenceById(employeeId);
        LocalDate today = LocalDate.now();

        Task task = saveTask(store, today.minusDays(1));
        saveResponse(task, store, employee, today, true);

        // Admin deactivates the task later the same day.
        task.setActive(false);
        taskRepository.save(task);

        TodayChecklistResponse liveChecklist = taskService.getTodayChecklistForEmployee(employeeId, storeId);
        assertThat(liveChecklist.categories()).isEmpty();

        ChecklistHistoryDetailResponse todaysHistory = meHistoryService.getDetail(employeeId, storeId, today);
        assertThat(todaysHistory.hasChecklist()).isFalse();
        assertThat(todaysHistory.categories()).isEmpty();

        // The response row itself is preserved -- once "today" is a past date
        // (simulated here by querying a date already in the past), it reappears.
        Task pastTask = saveTask(store, today.minusDays(3));
        saveResponse(pastTask, store, employee, today.minusDays(1), true);
        pastTask.setActive(false);
        taskRepository.save(pastTask);
        ChecklistHistoryDetailResponse pastHistory = meHistoryService.getDetail(employeeId, storeId, today.minusDays(1));
        assertThat(pastHistory.hasChecklist()).isTrue();
        assertThat(pastHistory.categories().get(0).tasks().get(0).id()).isEqualTo(pastTask.getId());
    }

    // 11. Today's History reflects a just-submitted response for a task that
    // remains on today's checklist -- both read paths query task_responses live
    // (no caching layer), so a response recorded via TaskService.submitResponse
    // shows up in MeHistoryService.getDetail for today without any extra step.
    @Test
    @Transactional
    void historyReflectsAResponseJustSubmittedToTodaysChecklist() {
        Store store = storeRepository.getReferenceById(storeId);
        Task task = saveTask(store, LocalDate.now().minusDays(1));
        LocalDate today = LocalDate.now();

        TodayChecklistResponse beforeSubmit = taskService.getTodayChecklistForEmployee(employeeId, storeId);
        assertThat(beforeSubmit.categories().get(0).tasks().get(0).responses()).isEmpty();
        ChecklistHistoryDetailResponse historyBeforeSubmit = meHistoryService.getDetail(employeeId, storeId, today);
        assertThat(historyBeforeSubmit.categories().get(0).tasks().get(0).completed()).isFalse();

        taskService.submitResponse(employeeId, task.getId(), new TaskResponseSubmitRequest(storeId, true, null, null));

        TodayChecklistResponse afterSubmit = taskService.getTodayChecklistForEmployee(employeeId, storeId);
        assertThat(afterSubmit.categories().get(0).tasks().get(0).responses()).hasSize(1);

        ChecklistHistoryDetailResponse historyAfterSubmit = meHistoryService.getDetail(employeeId, storeId, today);
        HistoryTaskItemResponse historyItem = historyAfterSubmit.categories().get(0).tasks().get(0);
        assertThat(historyItem.completed()).isTrue();
        assertThat(historyItem.responses()).hasSize(1);
        assertThat(historyItem.responses().get(0).booleanValue()).isTrue();
    }

    // 6. A same-day raised issue (Raise with Owner) surfaces in the employee's
    // History detail response -- independent of whether any checklist task was
    // ever configured/answered that day.
    @Test
    @Transactional
    void detailIncludesAnIssueRaisedTheSameDay() {
        Store store = storeRepository.getReferenceById(storeId);
        User employee = userRepository.getReferenceById(employeeId);

        RaisedIssue issue = new RaisedIssue();
        issue.setStore(store);
        issue.setEmployee(employee);
        issue.setNote("Freezer #2 is not cooling properly.");
        issue.setStatus(IssueStatus.OPEN);
        raisedIssueRepository.save(issue);

        ChecklistHistoryDetailResponse detail = meHistoryService.getDetail(employeeId, storeId, LocalDate.now());

        assertThat(detail.issues()).hasSize(1);
        assertThat(detail.issues().get(0).note()).isEqualTo("Freezer #2 is not cooling properly.");
        assertThat(detail.issues().get(0).status()).isEqualTo("OPEN");
        assertThat(detail.issues().get(0).responseText()).isNull();
    }

    // 7. An issue raised for a different day must not leak into today's history.
    @Test
    @Transactional
    void detailExcludesAnIssueRaisedOnADifferentDay() {
        Store store = storeRepository.getReferenceById(storeId);
        User employee = userRepository.getReferenceById(employeeId);

        RaisedIssue issue = new RaisedIssue();
        issue.setStore(store);
        issue.setEmployee(employee);
        issue.setNote("Yesterday's issue");
        issue.setStatus(IssueStatus.OPEN);
        issue.setRaisedDate(LocalDate.now().minusDays(1));
        raisedIssueRepository.save(issue);

        ChecklistHistoryDetailResponse detail = meHistoryService.getDetail(employeeId, storeId, LocalDate.now());

        assertThat(detail.issues()).isEmpty();
    }
}
