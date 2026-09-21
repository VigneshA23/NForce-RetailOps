package com.nforce.retailops.service;

import com.nforce.retailops.dto.ChecklistHistoryDetailResponse;
import com.nforce.retailops.dto.ChecklistHistoryOperationsReportResponse;
import com.nforce.retailops.dto.ChecklistHistorySummaryRow;
import com.nforce.retailops.dto.ChecklistHistoryTaskDetailRow;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.DayOfWeekCode;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidDateRangeException;
import com.nforce.retailops.exception.InvalidStoreSelectionException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChecklistHistoryServiceTest {

    private static final Long OWNER_ID = 1L;

    @Mock
    private TaskRepository taskRepository;
    @Mock
    private TaskResponseEntryRepository taskResponseEntryRepository;
    @Mock
    private StoreOwnerRepository storeOwnerRepository;
    @Mock
    private StoreEmployeeRepository storeEmployeeRepository;
    @Mock
    private com.nforce.retailops.repository.AdminCorrectionRepository adminCorrectionRepository;
    @Mock
    private com.nforce.retailops.repository.RaisedIssueRepository raisedIssueRepository;

    private ChecklistHistoryService checklistHistoryService;

    @BeforeEach
    void setUp() {
        checklistHistoryService = new ChecklistHistoryService(
            taskRepository, taskResponseEntryRepository, storeOwnerRepository,
            storeEmployeeRepository, adminCorrectionRepository, raisedIssueRepository
        );
    }

    private Store store(Long id, String name) {
        Store store = new Store();
        ReflectionTestUtils.setField(store, "id", id);
        store.setName(name);
        return store;
    }

    private StoreOwner storeOwner(Store store) {
        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store);
        return storeOwner;
    }

    private Category category(Long id, String name, int displayOrder) {
        Category category = new Category();
        ReflectionTestUtils.setField(category, "id", id);
        category.setName(name);
        category.setDisplayOrder(displayOrder);
        return category;
    }

    private Task task(Long id, Category category, ScheduleType scheduleType, Set<DayOfWeekCode> selectedDays, boolean active) {
        Task task = new Task();
        ReflectionTestUtils.setField(task, "id", id);
        task.setCategory(category);
        task.setName("Task " + id);
        task.setResponseType(ResponseType.YES_NO);
        task.setCompletionType(CompletionType.SINGLE);
        task.setScheduleType(scheduleType);
        task.setSelectedDays(selectedDays);
        task.setTimeMode(TimeMode.ANYTIME);
        task.setStartDate(LocalDate.now().minusYears(1));
        task.setActive(active);
        task.setAppliesToAllStores(true);
        task.setDisplayOrder(0);
        return task;
    }

    private User user(Long id, String fullName) {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", id);
        user.setFullName(fullName);
        return user;
    }

    private TaskResponseEntry response(Task task, Store store, User employee, LocalDate date) {
        TaskResponseEntry entry = new TaskResponseEntry();
        ReflectionTestUtils.setField(entry, "id", 500L);
        entry.setTask(task);
        entry.setStore(store);
        entry.setEmployee(employee);
        entry.setResponseDate(date);
        entry.setResponseType(ResponseType.YES_NO);
        entry.setCompletionType(CompletionType.SINGLE);
        entry.setValueBoolean(true);
        entry.setActive(true);
        ReflectionTestUtils.setField(entry, "createdAt", OffsetDateTime.now());
        return entry;
    }

    @Test
    void summaryOnlyCountsSelectedDaysTaskOnItsScheduledWeekdays() {
        LocalDate monday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate sunday = monday.plusDays(6);

        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByOwnerIdAndActiveTrue(OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));

        Category category = category(20L, "Opening", 0);
        Task mondayWednesdayTask = task(30L, category, ScheduleType.SELECTED_DAYS,
            Set.of(DayOfWeekCode.MON, DayOfWeekCode.WED), true);

        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L), monday, sunday))
            .thenReturn(List.of(mondayWednesdayTask));
        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L), monday, sunday))
            .thenReturn(List.of());

        List<ChecklistHistorySummaryRow> rows = checklistHistoryService.getSummary(OWNER_ID, null, monday, sunday);

        assertThat(rows).hasSize(7);
        assertThat(rows.stream().filter(ChecklistHistorySummaryRow::hasChecklist).count()).isEqualTo(2);
        assertThat(rows.stream()
            .filter(row -> row.date().equals(monday) || row.date().equals(monday.plusDays(2)))
            .allMatch(row -> row.totalTasks() == 1)).isTrue();
    }

    @Test
    void summaryReportsNoChecklistWhenNothingApplicableOrRecorded() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByOwnerIdAndStoreIdIn(OWNER_ID, List.of(10L))).thenReturn(List.of(storeOwner(store)));
        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L), today, today)).thenReturn(List.of());
        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L), today, today))
            .thenReturn(List.of());

        List<ChecklistHistorySummaryRow> rows = checklistHistoryService.getSummary(OWNER_ID, List.of(10L), today, today);

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).hasChecklist()).isFalse();
        assertThat(rows.get(0).totalTasks()).isZero();
        assertThat(rows.get(0).completedTasks()).isZero();
    }

    // Regression test for the union-based reconstruction: a task deactivated after
    // accumulating history must not disappear from -- or under-count -- the summary,
    // and completedTasks must never exceed totalTasks.
    @Test
    void summaryUnionCountsADeactivatedTaskThatStillHasAResponse() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByOwnerIdAndStoreIdIn(OWNER_ID, List.of(10L))).thenReturn(List.of(storeOwner(store)));

        Category category = category(20L, "Opening", 0);
        Task deactivatedTask = task(31L, category, ScheduleType.EVERY_DAY, Set.of(), false);
        // Excluded here because findActiveForStoresAndDateRange filters on active=true --
        // simulating a task deactivated after it accumulated history.
        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L), today, today)).thenReturn(List.of());
        when(taskRepository.findAllById(Set.of(31L))).thenReturn(List.of(deactivatedTask));

        User employee = user(99L, "Jane Doe");
        TaskResponseEntry response = response(deactivatedTask, store, employee, today);
        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L), today, today))
            .thenReturn(List.of(response));

        List<ChecklistHistorySummaryRow> rows = checklistHistoryService.getSummary(OWNER_ID, List.of(10L), today, today);

        assertThat(rows).hasSize(1);
        ChecklistHistorySummaryRow row = rows.get(0);
        assertThat(row.hasChecklist()).isTrue();
        assertThat(row.totalTasks()).isEqualTo(1);
        assertThat(row.completedTasks()).isEqualTo(1);
        assertThat(row.completedTasks()).isLessThanOrEqualTo(row.totalTasks());
    }

    // Regression test: a MULTIPLE-completion task must not count toward
    // completedTasks (and therefore the Owner/Admin's completion %) until at
    // least 2 distinct employees have responded -- one response alone must
    // leave it out of the completed count, same as the per-task `completed`
    // flag in getDetail below.
    @Test
    void summaryRequiresTwoDistinctRespondersForMultipleCompletionTask() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByOwnerIdAndStoreIdIn(OWNER_ID, List.of(10L))).thenReturn(List.of(storeOwner(store)));

        Category category = category(20L, "Opening", 0);
        Task task = task(30L, category, ScheduleType.EVERY_DAY, Set.of(), true);
        task.setCompletionType(CompletionType.MULTIPLE);
        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L), today, today)).thenReturn(List.of(task));

        User employee = user(99L, "Jane Doe");
        TaskResponseEntry response = response(task, store, employee, today);
        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L), today, today))
            .thenReturn(List.of(response));

        List<ChecklistHistorySummaryRow> rows = checklistHistoryService.getSummary(OWNER_ID, List.of(10L), today, today);

        assertThat(rows).hasSize(1);
        ChecklistHistorySummaryRow row = rows.get(0);
        assertThat(row.totalTasks()).isEqualTo(1);
        assertThat(row.completedTasks()).isZero();
    }

    // Regression test for the O(numStores) query fan-out fix: with multiple stores
    // requested, findActiveForStoresAndDateRange must be queried exactly once (not
    // once per store), and each store's row must only reflect tasks actually scoped
    // to it.
    @Test
    void summaryBatchesAcrossStoresAndRespectsPerStoreScoping() {
        LocalDate today = LocalDate.now();
        Store storeA = store(10L, "Downtown");
        Store storeB = store(11L, "Uptown");
        when(storeOwnerRepository.findByOwnerIdAndStoreIdIn(OWNER_ID, List.of(10L, 11L)))
            .thenReturn(List.of(storeOwner(storeA), storeOwner(storeB)));

        Category category = category(20L, "Opening", 0);
        Task allStoresTask = task(30L, category, ScheduleType.EVERY_DAY, Set.of(), true);
        Task storeAOnlyTask = task(31L, category, ScheduleType.EVERY_DAY, Set.of(), true);
        storeAOnlyTask.setAppliesToAllStores(false);

        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L, 11L), today, today))
            .thenReturn(List.of(allStoresTask, storeAOnlyTask));
        when(taskRepository.findStoreRowsGroupedByTaskIds(List.of(31L)))
            .thenReturn(List.<Object[]>of(new Object[] {31L, 10L, "Downtown"}));
        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L, 11L), today, today))
            .thenReturn(List.of());

        List<ChecklistHistorySummaryRow> rows =
            checklistHistoryService.getSummary(OWNER_ID, List.of(10L, 11L), today, today);

        assertThat(rows).hasSize(2);
        ChecklistHistorySummaryRow downtownRow = rows.stream()
            .filter(row -> row.storeName().equals("Downtown")).findFirst().orElseThrow();
        ChecklistHistorySummaryRow uptownRow = rows.stream()
            .filter(row -> row.storeName().equals("Uptown")).findFirst().orElseThrow();
        assertThat(downtownRow.totalTasks()).isEqualTo(2);
        assertThat(uptownRow.totalTasks()).isEqualTo(1);

        verify(taskRepository, times(1))
            .findActiveForStoresAndDateRange(OWNER_ID, List.of(10L, 11L), today, today);
    }

    // Daily Operations Summary report: issueCount must reuse the app's one
    // existing Issue definition (a Yes/No task whose latest response that
    // day was "No") -- not a newly invented rule -- and only the latest
    // response per task that day should be considered.
    @Test
    void summaryCountsAYesNoTaskAnsweredNoAsAnIssueUsingItsLatestResponseOnly() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByOwnerIdAndStoreIdIn(OWNER_ID, List.of(10L))).thenReturn(List.of(storeOwner(store)));

        Category category = category(20L, "Opening", 0);
        Task yesNoTask = task(30L, category, ScheduleType.EVERY_DAY, Set.of(), true);
        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L), today, today)).thenReturn(List.of(yesNoTask));

        User employee = user(99L, "Jane Doe");
        // An earlier "Yes" followed by a corrected, later "No" -- only the later
        // (higher createdAt) answer should count toward the exception.
        TaskResponseEntry earlierYes = response(yesNoTask, store, employee, today);
        earlierYes.setValueBoolean(true);
        ReflectionTestUtils.setField(earlierYes, "createdAt", OffsetDateTime.now().minusHours(1));

        TaskResponseEntry laterNo = response(yesNoTask, store, employee, today);
        laterNo.setValueBoolean(false);
        ReflectionTestUtils.setField(laterNo, "createdAt", OffsetDateTime.now());

        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L), today, today))
            .thenReturn(List.of(earlierYes, laterNo));

        List<ChecklistHistorySummaryRow> rows = checklistHistoryService.getSummary(OWNER_ID, List.of(10L), today, today);

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).issueCount()).isEqualTo(1);
        assertThat(rows.get(0).completedTasks()).isEqualTo(1);
    }

    @Test
    void summaryHasZeroIssueCountWhenNothingIsScheduledOrRecorded() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByOwnerIdAndStoreIdIn(OWNER_ID, List.of(10L))).thenReturn(List.of(storeOwner(store)));
        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L), today, today)).thenReturn(List.of());
        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L), today, today))
            .thenReturn(List.of());

        List<ChecklistHistorySummaryRow> rows = checklistHistoryService.getSummary(OWNER_ID, List.of(10L), today, today);

        assertThat(rows.get(0).issueCount()).isZero();
    }

    // --- Daily Operations Summary report (getOperationsReport) ---
    // Deliberately never accepts a storeIds param from the caller -- these tests
    // confirm it always resolves through the SAME owner-authorization path as the
    // rest of the app (findByOwnerIdAndActiveTrue), so an Owner/Admin can never
    // retrieve another store's summary or task-level details.

    @Test
    void operationsReportOnlyIncludesTheCallersOwnAuthorizedStore() {
        LocalDate today = LocalDate.now();
        Store myStore = store(10L, "Downtown");
        when(storeOwnerRepository.findByOwnerIdAndActiveTrue(OWNER_ID)).thenReturn(Optional.of(storeOwner(myStore)));
        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L), today, today)).thenReturn(List.of());
        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L), today, today))
            .thenReturn(List.of());

        ChecklistHistoryOperationsReportResponse report =
            checklistHistoryService.getOperationsReport(OWNER_ID, today, today);

        assertThat(report.summary()).hasSize(1);
        assertThat(report.summary().get(0).storeName()).isEqualTo("Downtown");
        assertThat(report.details()).isEmpty();
    }

    @Test
    void operationsReportReturnsEmptySummaryAndDetailsWhenOwnerHasNoAssignedStore() {
        LocalDate today = LocalDate.now();
        when(storeOwnerRepository.findByOwnerIdAndActiveTrue(OWNER_ID)).thenReturn(Optional.empty());

        ChecklistHistoryOperationsReportResponse report =
            checklistHistoryService.getOperationsReport(OWNER_ID, today, today);

        assertThat(report.summary()).isEmpty();
        assertThat(report.details()).isEmpty();
    }

    @Test
    void operationsReportMarksAnUnansweredEligibleTaskAsNotCompletedInDetails() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByOwnerIdAndActiveTrue(OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));

        Category category = category(20L, "Opening", 0);
        Task task = task(30L, category, ScheduleType.EVERY_DAY, Set.of(), true);
        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L), today, today)).thenReturn(List.of(task));
        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L), today, today))
            .thenReturn(List.of());

        ChecklistHistoryOperationsReportResponse report =
            checklistHistoryService.getOperationsReport(OWNER_ID, today, today);

        assertThat(report.details()).hasSize(1);
        ChecklistHistoryTaskDetailRow row = report.details().get(0);
        assertThat(row.status()).isEqualTo("NOT_COMPLETED");
        assertThat(row.employeeFullName()).isNull();
        assertThat(row.completedAt()).isNull();
    }

    @Test
    void operationsReportMarksACompletedTaskWithResponseEmployeeAndTimestamp() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByOwnerIdAndActiveTrue(OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));

        Category category = category(20L, "Opening", 0);
        Task task = task(30L, category, ScheduleType.EVERY_DAY, Set.of(), true);
        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L), today, today)).thenReturn(List.of(task));

        User employee = user(99L, "Jane Doe");
        TaskResponseEntry yes = response(task, store, employee, today);
        yes.setValueBoolean(true);
        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L), today, today))
            .thenReturn(List.of(yes));

        ChecklistHistoryOperationsReportResponse report =
            checklistHistoryService.getOperationsReport(OWNER_ID, today, today);

        assertThat(report.details()).hasSize(1);
        ChecklistHistoryTaskDetailRow row = report.details().get(0);
        assertThat(row.status()).isEqualTo("COMPLETED");
        assertThat(row.response()).isEqualTo("Yes");
        assertThat(row.employeeFullName()).isEqualTo("Jane Doe");
        assertThat(row.completedAt()).isNotNull();
        assertThat(row.categoryName()).isEqualTo("Opening");
    }

    @Test
    void operationsReportMarksAYesNoTaskAnsweredNoAsIssueInDetails() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByOwnerIdAndActiveTrue(OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));

        Category category = category(20L, "Opening", 0);
        Task task = task(30L, category, ScheduleType.EVERY_DAY, Set.of(), true);
        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L), today, today)).thenReturn(List.of(task));

        User employee = user(99L, "Jane Doe");
        TaskResponseEntry no = response(task, store, employee, today);
        no.setValueBoolean(false);
        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L), today, today))
            .thenReturn(List.of(no));

        ChecklistHistoryOperationsReportResponse report =
            checklistHistoryService.getOperationsReport(OWNER_ID, today, today);

        assertThat(report.details()).hasSize(1);
        ChecklistHistoryTaskDetailRow row = report.details().get(0);
        assertThat(row.status()).isEqualTo("ISSUE");
        assertThat(row.response()).isEqualTo("No");
        assertThat(report.summary().get(0).issueCount()).isEqualTo(1);
    }

    // Regression test: a deactivated task (or one under a deactivated category), with
    // no response of its own that day, must still appear in the export -- as an
    // "Inactive" row -- instead of silently disappearing, while never inflating the
    // Scheduled/Completed summary counts (it isn't in unionTaskIds).
    @Test
    void operationsReportListsADeactivatedTaskWithNoResponseAsInactiveWithoutInflatingSummary() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByOwnerIdAndActiveTrue(OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));

        Category category = category(20L, "Opening", 0);
        Task deactivatedTask = task(31L, category, ScheduleType.EVERY_DAY, Set.of(), false);
        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L), today, today)).thenReturn(List.of());
        when(taskRepository.findByOwnerIdOrderByCategoryAndDisplayOrderFetchCategory(OWNER_ID))
            .thenReturn(List.of(deactivatedTask));
        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L), today, today))
            .thenReturn(List.of());

        ChecklistHistoryOperationsReportResponse report =
            checklistHistoryService.getOperationsReport(OWNER_ID, today, today);

        assertThat(report.details()).hasSize(1);
        ChecklistHistoryTaskDetailRow row = report.details().get(0);
        assertThat(row.status()).isEqualTo("INACTIVE");
        assertThat(row.taskName()).isEqualTo(deactivatedTask.getName());
        assertThat(row.employeeFullName()).isNull();
        // Scheduled=0, Completed=0 -- the inactive task never joins unionTaskIds/respondedTaskIds.
        assertThat(report.summary().get(0).totalTasks()).isZero();
        assertThat(report.summary().get(0).completedTasks()).isZero();
    }

    // Regression test: an employee answered a task and then explicitly Undid it (no
    // resubmission since) -- the export must show that instead of a bare "Not
    // Completed" row with no employee/timestamp, mirroring what History already does.
    @Test
    void operationsReportShowsWhoUndidATaskWithNoActiveResponseSince() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByOwnerIdAndActiveTrue(OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));

        Category category = category(20L, "Opening", 0);
        Task task = task(30L, category, ScheduleType.EVERY_DAY, Set.of(), true);
        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L), today, today)).thenReturn(List.of(task));
        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L), today, today))
            .thenReturn(List.of());

        User employee = user(99L, "Jane Doe");
        TaskResponseEntry undone = response(task, store, employee, today);
        undone.setActive(false);
        ReflectionTestUtils.setField(undone, "undoneAt", OffsetDateTime.now());
        ReflectionTestUtils.setField(undone, "undoneByUser", true);
        when(taskResponseEntryRepository
            .findByStoreIdInAndResponseDateBetweenAndActiveFalseAndUndoneByUserTrue(List.of(10L), today, today))
            .thenReturn(List.of(undone));

        ChecklistHistoryOperationsReportResponse report =
            checklistHistoryService.getOperationsReport(OWNER_ID, today, today);

        assertThat(report.details()).hasSize(1);
        ChecklistHistoryTaskDetailRow row = report.details().get(0);
        assertThat(row.status()).isEqualTo("NOT_COMPLETED");
        // The undone response's real stored value is "Yes" (true), but the display
        // reflects the current (undone) state, not the stale pre-undo answer.
        assertThat(row.response()).isEqualTo("No");
        assertThat(row.employeeFullName()).isEqualTo("Jane Doe");
        assertThat(row.completedAt()).isNotNull();
        assertThat(row.responseType()).isEqualTo("YES_NO");
        assertThat(row.correctionHistory()).hasSize(1);
        assertThat(row.correctionHistory().get(0).correctionType()).isEqualTo("UNDONE");
        assertThat(row.correctionHistory().get(0).correctedByFullName()).isEqualTo("Jane Doe");
    }

    // Regression test: an admin's DIRECT edit of a response's value must show up in
    // the export's correctionHistory, batched via buildCorrectionHistories rather
    // than the single-response buildCorrectionHistory (which would be an N+1 if
    // called once per report row).
    @Test
    void operationsReportIncludesADirectAdminCorrectionInCorrectionHistory() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByOwnerIdAndActiveTrue(OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));

        Category category = category(20L, "Opening", 0);
        Task task = task(30L, category, ScheduleType.EVERY_DAY, Set.of(), true);
        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L), today, today)).thenReturn(List.of(task));

        User employee = user(99L, "Jane Doe");
        TaskResponseEntry current = response(task, store, employee, today);
        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L), today, today))
            .thenReturn(List.of(current));

        User admin = user(88L, "Admin User");
        com.nforce.retailops.entity.AdminCorrection correction = new com.nforce.retailops.entity.AdminCorrection();
        correction.setTaskResponse(current);
        correction.setCorrectedBy(admin);
        correction.setOriginalValueBoolean(false);
        correction.setCorrectedValueBoolean(true);
        correction.setCorrectionType("DIRECT");
        ReflectionTestUtils.setField(correction, "correctedAt", OffsetDateTime.now());
        when(adminCorrectionRepository.findByTaskResponseIdIn(any())).thenReturn(List.of(correction));

        ChecklistHistoryOperationsReportResponse report =
            checklistHistoryService.getOperationsReport(OWNER_ID, today, today);

        assertThat(report.details()).hasSize(1);
        ChecklistHistoryTaskDetailRow row = report.details().get(0);
        assertThat(row.correctionHistory()).hasSize(1);
        assertThat(row.correctionHistory().get(0).correctionType()).isEqualTo("DIRECT");
        assertThat(row.correctionHistory().get(0).correctedByFullName()).isEqualTo("Admin User");
    }

    // Regression test: a MULTIPLE-task resubmission (or a flag -> resubmit cycle)
    // chains the new response back to the one it replaced via supersededResponseId --
    // the export must surface that as a synthesized RESUBMISSION entry, resolved via
    // buildCorrectionHistories' batched frontier walk (findAllById), not one findById
    // per hop.
    @Test
    void operationsReportIncludesAResubmissionInCorrectionHistory() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByOwnerIdAndActiveTrue(OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));

        Category category = category(20L, "Opening", 0);
        Task task = task(30L, category, ScheduleType.EVERY_DAY, Set.of(), true);
        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L), today, today)).thenReturn(List.of(task));

        User employee = user(99L, "Jane Doe");
        TaskResponseEntry older = response(task, store, employee, today);
        ReflectionTestUtils.setField(older, "id", 501L);
        older.setValueBoolean(false);
        older.setActive(false);

        TaskResponseEntry newer = response(task, store, employee, today);
        ReflectionTestUtils.setField(newer, "id", 502L);
        newer.setValueBoolean(true);
        newer.setSupersededResponseId(501L);

        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L), today, today))
            .thenReturn(List.of(newer));
        when(taskResponseEntryRepository.findAllById(any())).thenReturn(List.of(older));

        ChecklistHistoryOperationsReportResponse report =
            checklistHistoryService.getOperationsReport(OWNER_ID, today, today);

        assertThat(report.details()).hasSize(1);
        ChecklistHistoryTaskDetailRow row = report.details().get(0);
        assertThat(row.correctionHistory()).hasSize(1);
        assertThat(row.correctionHistory().get(0).correctionType()).isEqualTo("RESUBMISSION");
        assertThat(row.correctionHistory().get(0).correctedByFullName()).isEqualTo("Jane Doe");
    }

    // --- Daily Operations Summary report for Super Admin (getOperationsReportForSuperAdmin) ---

    @Test
    void operationsReportForSuperAdminScopesToTheStoresActualOwner() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        User owner = user(OWNER_ID, "Store Owner");
        StoreOwner storeOwner = storeOwner(store);
        storeOwner.setOwner(owner);
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(10L)).thenReturn(Optional.of(storeOwner));
        when(storeOwnerRepository.findByOwnerIdAndStoreIdIn(OWNER_ID, List.of(10L))).thenReturn(List.of(storeOwner));
        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L), today, today)).thenReturn(List.of());
        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L), today, today))
            .thenReturn(List.of());

        ChecklistHistoryOperationsReportResponse report =
            checklistHistoryService.getOperationsReportForSuperAdmin(10L, today, today);

        assertThat(report.summary()).hasSize(1);
        assertThat(report.summary().get(0).storeName()).isEqualTo("Downtown");
    }

    @Test
    void operationsReportForSuperAdminThrowsWhenStoreDoesNotExist() {
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
            checklistHistoryService.getOperationsReportForSuperAdmin(99L, LocalDate.now(), LocalDate.now()))
            .isInstanceOf(StoreNotFoundException.class);
    }

    @Test
    void operationsReportForSuperAdminThrowsWhenStoreIdIsNull() {
        assertThatThrownBy(() ->
            checklistHistoryService.getOperationsReportForSuperAdmin(null, LocalDate.now(), LocalDate.now()))
            .isInstanceOf(StoreNotFoundException.class);
    }

    @Test
    void summaryRejectsStartDateAfterEndDate() {
        LocalDate today = LocalDate.now();
        assertThatThrownBy(() ->
            checklistHistoryService.getSummary(OWNER_ID, List.of(10L), today, today.minusDays(1)))
            .isInstanceOf(InvalidDateRangeException.class);
    }

    @Test
    void summaryRejectsRangeLongerThan92Days() {
        LocalDate start = LocalDate.now().minusDays(200);
        LocalDate end = start.plusDays(93);
        assertThatThrownBy(() -> checklistHistoryService.getSummary(OWNER_ID, List.of(10L), start, end))
            .isInstanceOf(InvalidDateRangeException.class);
    }

    @Test
    void summaryRejectsStoreNotOwnedByCaller() {
        LocalDate today = LocalDate.now();
        when(storeOwnerRepository.findByOwnerIdAndStoreIdIn(OWNER_ID, List.of(99L))).thenReturn(List.of());

        assertThatThrownBy(() -> checklistHistoryService.getSummary(OWNER_ID, List.of(99L), today, today))
            .isInstanceOf(InvalidStoreSelectionException.class);
    }

    @Test
    void detailRejectsStoreNotOwnedByCaller() {
        LocalDate today = LocalDate.now();
        when(storeOwnerRepository.findByStoreIdAndOwnerId(5L, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> checklistHistoryService.getDetail(OWNER_ID, 5L, today))
            .isInstanceOf(StoreNotFoundException.class);
    }

    @Test
    void detailIncludesDeactivatedTaskWithHistoryAndEnrichesEmpId() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByStoreIdAndOwnerId(10L, OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));

        Category category = category(20L, "Opening", 0);
        Task deactivatedTask = task(31L, category, ScheduleType.EVERY_DAY, Set.of(), false);
        when(taskRepository.findForStoreAndDate(OWNER_ID, 10L, today)).thenReturn(List.of());
        when(taskRepository.findAllById(Set.of(31L))).thenReturn(List.of(deactivatedTask));

        User employee = user(99L, "Jane Doe");
        TaskResponseEntry entry = response(deactivatedTask, store, employee, today);
        when(taskResponseEntryRepository.findByStoreIdAndResponseDateAndActiveTrue(10L, today))
            .thenReturn(List.of(entry));

        StoreEmployee storeEmployee = new StoreEmployee();
        ReflectionTestUtils.setField(storeEmployee, "id", 4L);
        storeEmployee.setEmployee(employee);
        when(storeEmployeeRepository.findByEmployeeIdIn(List.of(99L))).thenReturn(List.of(storeEmployee));

        ChecklistHistoryDetailResponse detail = checklistHistoryService.getDetail(OWNER_ID, 10L, today);

        assertThat(detail.hasChecklist()).isTrue();
        assertThat(detail.categories()).hasSize(1);
        var item = detail.categories().get(0).tasks().get(0);
        assertThat(item.currentlyActive()).isFalse();
        assertThat(item.completed()).isTrue();
        assertThat(item.responses()).hasSize(1);
        assertThat(item.responses().get(0).empId()).isEqualTo("EMP-004");
    }

    @Test
    void detailIncludesTaskUnderDeactivatedCategoryWithHistory() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByStoreIdAndOwnerId(10L, OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));

        Category deactivatedCategory = category(20L, "Opening", 0);
        deactivatedCategory.setActive(false);
        Task task = task(31L, deactivatedCategory, ScheduleType.EVERY_DAY, Set.of(), true);
        when(taskRepository.findForStoreAndDate(OWNER_ID, 10L, today)).thenReturn(List.of());
        when(taskRepository.findAllById(Set.of(31L))).thenReturn(List.of(task));

        User employee = user(99L, "Jane Doe");
        TaskResponseEntry entry = response(task, store, employee, today);
        when(taskResponseEntryRepository.findByStoreIdAndResponseDateAndActiveTrue(10L, today))
            .thenReturn(List.of(entry));
        when(storeEmployeeRepository.findByEmployeeIdIn(List.of(99L))).thenReturn(List.of());

        ChecklistHistoryDetailResponse detail = checklistHistoryService.getDetail(OWNER_ID, 10L, today);

        assertThat(detail.hasChecklist()).isTrue();
        assertThat(detail.categories()).hasSize(1);
        assertThat(detail.categories().get(0).name()).isEqualTo("Opening");
        var item = detail.categories().get(0).tasks().get(0);
        assertThat(item.completed()).isTrue();
        assertThat(item.responses()).hasSize(1);
    }

    @Test
    void detailIncludesTaskWhenBothCategoryAndTaskAreDeactivated() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByStoreIdAndOwnerId(10L, OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));

        Category deactivatedCategory = category(20L, "Opening", 0);
        deactivatedCategory.setActive(false);
        Task deactivatedTask = task(31L, deactivatedCategory, ScheduleType.EVERY_DAY, Set.of(), false);
        when(taskRepository.findForStoreAndDate(OWNER_ID, 10L, today)).thenReturn(List.of());
        when(taskRepository.findAllById(Set.of(31L))).thenReturn(List.of(deactivatedTask));

        User employee = user(99L, "Jane Doe");
        TaskResponseEntry entry = response(deactivatedTask, store, employee, today);
        when(taskResponseEntryRepository.findByStoreIdAndResponseDateAndActiveTrue(10L, today))
            .thenReturn(List.of(entry));
        when(storeEmployeeRepository.findByEmployeeIdIn(List.of(99L))).thenReturn(List.of());

        ChecklistHistoryDetailResponse detail = checklistHistoryService.getDetail(OWNER_ID, 10L, today);

        assertThat(detail.hasChecklist()).isTrue();
        assertThat(detail.categories()).hasSize(1);
        assertThat(detail.categories().get(0).name()).isEqualTo("Opening");
        var item = detail.categories().get(0).tasks().get(0);
        assertThat(item.currentlyActive()).isFalse();
        assertThat(item.completed()).isTrue();
        assertThat(item.responses()).hasSize(1);
    }

    // Regression test for the actual gap being fixed: an inactive Task that has NEVER
    // been answered on this date must still appear -- not just one that already has
    // history (the tests above). findForStoreAndDate itself returns it directly, no
    // findAllById fallback involved.
    @Test
    void detailIncludesInactiveTaskWithNoResponses() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByStoreIdAndOwnerId(10L, OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));

        Category category = category(20L, "Opening", 0);
        Task inactiveTask = task(31L, category, ScheduleType.EVERY_DAY, Set.of(), false);
        when(taskRepository.findForStoreAndDate(OWNER_ID, 10L, today)).thenReturn(List.of(inactiveTask));
        when(taskResponseEntryRepository.findByStoreIdAndResponseDateAndActiveTrue(10L, today))
            .thenReturn(List.of());

        ChecklistHistoryDetailResponse detail = checklistHistoryService.getDetail(OWNER_ID, 10L, today);

        assertThat(detail.hasChecklist()).isTrue();
        assertThat(detail.categories()).hasSize(1);
        assertThat(detail.categories().get(0).name()).isEqualTo("Opening");
        var item = detail.categories().get(0).tasks().get(0);
        assertThat(item.currentlyActive()).isFalse();
        assertThat(item.completed()).isFalse();
        assertThat(item.responses()).isEmpty();
    }

    // Same gap, for the Category side: an active Task under an inactive Category with
    // no responses yet must still appear, grouped under that category.
    @Test
    void detailIncludesTaskUnderInactiveCategoryWithNoResponses() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByStoreIdAndOwnerId(10L, OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));

        Category inactiveCategory = category(20L, "Opening", 0);
        inactiveCategory.setActive(false);
        Task task = task(31L, inactiveCategory, ScheduleType.EVERY_DAY, Set.of(), true);
        when(taskRepository.findForStoreAndDate(OWNER_ID, 10L, today)).thenReturn(List.of(task));
        when(taskResponseEntryRepository.findByStoreIdAndResponseDateAndActiveTrue(10L, today))
            .thenReturn(List.of());

        ChecklistHistoryDetailResponse detail = checklistHistoryService.getDetail(OWNER_ID, 10L, today);

        assertThat(detail.hasChecklist()).isTrue();
        assertThat(detail.categories()).hasSize(1);
        assertThat(detail.categories().get(0).name()).isEqualTo("Opening");
        var item = detail.categories().get(0).tasks().get(0);
        assertThat(item.currentlyActive()).isTrue();
        assertThat(item.completed()).isFalse();
        assertThat(item.responses()).isEmpty();
    }

    // Regression test for the reported bug: a MULTIPLE-completion task must stay
    // Open in the Owner/Admin Daily Checklist after only one employee's response
    // -- it should not flip to Completed until a second distinct employee responds.
    @Test
    void detailMarksMultipleCompletionTaskAsOpenWithOnlyOneResponse() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByStoreIdAndOwnerId(10L, OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));

        Category category = category(20L, "Opening", 0);
        Task task = task(31L, category, ScheduleType.EVERY_DAY, Set.of(), true);
        task.setCompletionType(CompletionType.MULTIPLE);
        when(taskRepository.findForStoreAndDate(OWNER_ID, 10L, today)).thenReturn(List.of(task));

        User employee = user(99L, "Jane Doe");
        TaskResponseEntry entry = response(task, store, employee, today);
        when(taskResponseEntryRepository.findByStoreIdAndResponseDateAndActiveTrue(10L, today))
            .thenReturn(List.of(entry));
        when(storeEmployeeRepository.findByEmployeeIdIn(List.of(99L))).thenReturn(List.of());

        ChecklistHistoryDetailResponse detail = checklistHistoryService.getDetail(OWNER_ID, 10L, today);

        var item = detail.categories().get(0).tasks().get(0);
        assertThat(item.completed()).isFalse();
        assertThat(item.responses()).hasSize(1);
    }

    // Same task, second distinct employee responds -- now it should flip to Completed.
    @Test
    void detailMarksMultipleCompletionTaskAsCompletedWithTwoDistinctResponses() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByStoreIdAndOwnerId(10L, OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));

        Category category = category(20L, "Opening", 0);
        Task task = task(31L, category, ScheduleType.EVERY_DAY, Set.of(), true);
        task.setCompletionType(CompletionType.MULTIPLE);
        when(taskRepository.findForStoreAndDate(OWNER_ID, 10L, today)).thenReturn(List.of(task));

        User employeeA = user(99L, "Jane Doe");
        User employeeB = user(100L, "John Smith");
        TaskResponseEntry entryA = response(task, store, employeeA, today);
        ReflectionTestUtils.setField(entryA, "id", 501L);
        TaskResponseEntry entryB = response(task, store, employeeB, today);
        ReflectionTestUtils.setField(entryB, "id", 502L);
        when(taskResponseEntryRepository.findByStoreIdAndResponseDateAndActiveTrue(10L, today))
            .thenReturn(List.of(entryA, entryB));
        when(storeEmployeeRepository.findByEmployeeIdIn(List.of(99L, 100L))).thenReturn(List.of());

        ChecklistHistoryDetailResponse detail = checklistHistoryService.getDetail(OWNER_ID, 10L, today);

        var item = detail.categories().get(0).tasks().get(0);
        assertThat(item.completed()).isTrue();
        assertThat(item.responses()).hasSize(2);
    }

    @Test
    void detailIncludesRaisedIssuesForTheStoreAndDate() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByStoreIdAndOwnerId(10L, OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));
        when(taskRepository.findForStoreAndDate(OWNER_ID, 10L, today)).thenReturn(List.of());
        when(taskResponseEntryRepository.findByStoreIdAndResponseDateAndActiveTrue(10L, today)).thenReturn(List.of());

        com.nforce.retailops.entity.RaisedIssue issue = new com.nforce.retailops.entity.RaisedIssue();
        ReflectionTestUtils.setField(issue, "id", 7L);
        issue.setNote("Freezer is warm");
        issue.setStatus("OPEN");
        ReflectionTestUtils.setField(issue, "createdAt", OffsetDateTime.now());
        when(raisedIssueRepository.findByStoreIdAndRaisedDateOrderByCreatedAtDesc(10L, today))
            .thenReturn(List.of(issue));

        ChecklistHistoryDetailResponse detail = checklistHistoryService.getDetail(OWNER_ID, 10L, today);

        assertThat(detail.issues()).hasSize(1);
        assertThat(detail.issues().get(0).note()).isEqualTo("Freezer is warm");
        assertThat(detail.issues().get(0).status()).isEqualTo("OPEN");
    }

    @Test
    void detailReturnsEmptyCategoriesAndHasChecklistFalseWhenNothingApplies() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByStoreIdAndOwnerId(10L, OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));
        when(taskRepository.findForStoreAndDate(OWNER_ID, 10L, today)).thenReturn(List.of());
        when(taskResponseEntryRepository.findByStoreIdAndResponseDateAndActiveTrue(10L, today)).thenReturn(List.of());

        ChecklistHistoryDetailResponse detail = checklistHistoryService.getDetail(OWNER_ID, 10L, today);

        assertThat(detail.hasChecklist()).isFalse();
        assertThat(detail.categories()).isEmpty();
    }
}
