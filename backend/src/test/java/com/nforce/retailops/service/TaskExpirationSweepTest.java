package com.nforce.retailops.service;

import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.DayOfWeekCode;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises deactivateTasksPastEndDate() (the query behind both the nightly 3 AM sweep
 * and the ApplicationReadyEvent startup sweep) against a real (H2, Postgres-compatible)
 * database, the same way TaskResponsePersistenceTest proves other Task behavior against
 * a real DB rather than mocks. Deliberately does NOT wrap test methods in @Transactional:
 * a bulk @Modifying query only updates the underlying rows, not any Task instance already
 * held in the current persistence context, so reading the result back through the same
 * session/transaction as the write would see stale data. Each step here uses its own
 * (real, committing) transaction, mirroring how the update and a later Admin Tasks page
 * read are two separate transactions in production.
 */
@SpringBootTest
@ActiveProfiles("test")
class TaskExpirationSweepTest {

    @Autowired
    private TaskService taskService;
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private CategoryRepository categoryRepository;
    @Autowired
    private UserRepository userRepository;

    private Long ownerId;
    private Long categoryId;

    @BeforeEach
    void setUp() {
        User owner = new User();
        owner.setEmail("expiration-owner-" + System.nanoTime() + "@nforce.test");
        owner.setPasswordHash("irrelevant-hash");
        owner.setFullName("Expiration Owner");
        owner = userRepository.save(owner);
        ownerId = owner.getId();

        Category category = new Category();
        category.setOwner(owner);
        category.setName("Expiration Category " + System.nanoTime());
        category.setDisplayOrder(1);
        category = categoryRepository.save(category);
        categoryId = category.getId();
    }

    private Task task(ScheduleType scheduleType, LocalDate startDate, LocalDate endDate) {
        Task task = new Task();
        task.setOwner(userRepository.findById(ownerId).orElseThrow());
        task.setCategory(categoryRepository.findById(categoryId).orElseThrow());
        task.setName("Task " + scheduleType + " " + System.nanoTime());
        task.setDisplayOrder(1);
        task.setAppliesToAllStores(true);
        task.setResponseType(ResponseType.YES_NO);
        task.setCompletionType(CompletionType.SINGLE);
        task.setScheduleType(scheduleType);
        if (scheduleType == ScheduleType.SELECTED_DAYS) {
            task.setSelectedDays(Set.of(DayOfWeekCode.MON, DayOfWeekCode.WED));
        }
        task.setStartDate(startDate);
        task.setEndDate(endDate);
        task.setTimeMode(TimeMode.ANYTIME);
        task.setActive(true);
        return taskRepository.save(task);
    }

    private boolean isActive(Long taskId) {
        return taskRepository.findById(taskId).orElseThrow().isActive();
    }

    @Test
    void deactivatesExpiredTasksAcrossEveryScheduleTypeRegardlessOfType() {
        LocalDate farPast = LocalDate.now().minusYears(1);
        LocalDate yesterday = LocalDate.now().minusDays(1);

        Long oneTimeTaskId = task(ScheduleType.EVERY_DAY, yesterday, yesterday).getId();
        Long everyDayTaskId = task(ScheduleType.EVERY_DAY, farPast, yesterday).getId();
        Long weekdaysTaskId = task(ScheduleType.WEEKDAYS, farPast, yesterday).getId();
        Long weekendsTaskId = task(ScheduleType.WEEKENDS, farPast, yesterday).getId();
        Long selectedDaysTaskId = task(ScheduleType.SELECTED_DAYS, farPast, yesterday).getId();

        taskService.deactivateTasksPastEndDate();

        assertThat(isActive(oneTimeTaskId)).isFalse();
        assertThat(isActive(everyDayTaskId)).isFalse();
        assertThat(isActive(weekdaysTaskId)).isFalse();
        assertThat(isActive(weekendsTaskId)).isFalse();
        assertThat(isActive(selectedDaysTaskId)).isFalse();
    }

    @Test
    void doesNotTouchTasksWhoseEndDateHasNotPassedOrIsOpenEnded() {
        LocalDate farPast = LocalDate.now().minusYears(1);
        LocalDate today = LocalDate.now();
        LocalDate future = LocalDate.now().plusDays(30);

        Long endsTodayTaskId = task(ScheduleType.EVERY_DAY, farPast, today).getId();
        Long endsInFutureTaskId = task(ScheduleType.WEEKDAYS, farPast, future).getId();
        Long openEndedTaskId = task(ScheduleType.SELECTED_DAYS, farPast, null).getId();

        taskService.deactivateTasksPastEndDate();

        assertThat(isActive(endsTodayTaskId)).isTrue();
        assertThat(isActive(endsInFutureTaskId)).isTrue();
        assertThat(isActive(openEndedTaskId)).isTrue();
    }

    @Test
    void startupSweepRunsTheSameExpirationLogicAsTheNightlyJob() {
        Long taskId = task(ScheduleType.WEEKENDS, LocalDate.now().minusYears(1), LocalDate.now().minusDays(1)).getId();

        taskService.deactivateTasksPastEndDateOnStartup();

        assertThat(isActive(taskId)).isFalse();
    }
}
