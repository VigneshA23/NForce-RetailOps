package com.nforce.retailops.service;

import com.nforce.retailops.dto.ChecklistHistoryDetailResponse;
import com.nforce.retailops.dto.ChecklistHistorySummaryRow;
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

    private ChecklistHistoryService checklistHistoryService;

    @BeforeEach
    void setUp() {
        checklistHistoryService = new ChecklistHistoryService(
            taskRepository, taskResponseEntryRepository, storeOwnerRepository, storeEmployeeRepository
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

    // Daily Operations Summary report: exceptionCount must reuse the app's one
    // existing exception definition (a Yes/No task whose latest response that
    // day was "No") -- not a newly invented rule -- and only the latest
    // response per task that day should be considered.
    @Test
    void summaryCountsAYesNoTaskAnsweredNoAsAnExceptionUsingItsLatestResponseOnly() {
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
        assertThat(rows.get(0).exceptionCount()).isEqualTo(1);
        assertThat(rows.get(0).completedTasks()).isEqualTo(1);
    }

    @Test
    void summaryHasZeroExceptionCountWhenNothingIsScheduledOrRecorded() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByOwnerIdAndStoreIdIn(OWNER_ID, List.of(10L))).thenReturn(List.of(storeOwner(store)));
        when(taskRepository.findActiveForStoresAndDateRange(OWNER_ID, List.of(10L), today, today)).thenReturn(List.of());
        when(taskResponseEntryRepository.findByStoreIdInAndResponseDateBetweenAndActiveTrue(List.of(10L), today, today))
            .thenReturn(List.of());

        List<ChecklistHistorySummaryRow> rows = checklistHistoryService.getSummary(OWNER_ID, List.of(10L), today, today);

        assertThat(rows.get(0).exceptionCount()).isZero();
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
        when(taskRepository.findActiveForStoreAndDate(OWNER_ID, 10L, today)).thenReturn(List.of());
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
    void detailReturnsEmptyCategoriesAndHasChecklistFalseWhenNothingApplies() {
        LocalDate today = LocalDate.now();
        Store store = store(10L, "Downtown");
        when(storeOwnerRepository.findByStoreIdAndOwnerId(10L, OWNER_ID)).thenReturn(Optional.of(storeOwner(store)));
        when(taskRepository.findActiveForStoreAndDate(OWNER_ID, 10L, today)).thenReturn(List.of());
        when(taskResponseEntryRepository.findByStoreIdAndResponseDateAndActiveTrue(10L, today)).thenReturn(List.of());

        ChecklistHistoryDetailResponse detail = checklistHistoryService.getDetail(OWNER_ID, 10L, today);

        assertThat(detail.hasChecklist()).isFalse();
        assertThat(detail.categories()).isEmpty();
    }
}
