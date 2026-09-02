package com.nforce.retailops.service;

import com.nforce.retailops.dto.TaskRequest;
import com.nforce.retailops.dto.TaskResponse;
import com.nforce.retailops.dto.TaskResponseSubmitRequest;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.exception.InvalidTaskConfigurationException;
import com.nforce.retailops.exception.TaskAlreadyCompletedException;
import com.nforce.retailops.exception.TaskHasHistoryException;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    private static final Long OWNER_ID = 1L;
    private static final Long CATEGORY_ID = 5L;

    @Mock
    private TaskRepository taskRepository;
    @Mock
    private CategoryRepository categoryRepository;
    @Mock
    private StoreOwnerRepository storeOwnerRepository;
    @Mock
    private StoreRepository storeRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private UserProfileService userProfileService;
    @Mock
    private TaskResponseEntryRepository taskResponseEntryRepository;

    @InjectMocks
    private TaskService taskService;

    private Category category;

    @BeforeEach
    void setUp() {
        category = new Category();
        ReflectionTestUtils.setField(category, "id", CATEGORY_ID);
        ReflectionTestUtils.setField(category, "name", "Cleaning");
    }

    private TaskRequest requestWithResponseType(ResponseType responseType, String responseNote) {
        return new TaskRequest(
            "Clean counter",
            null,
            CATEGORY_ID,
            null,
            true,
            null,
            responseType,
            responseNote,
            null,
            null,
            null,
            null,
            CompletionType.SINGLE,
            null,
            ScheduleType.EVERY_DAY,
            null,
            LocalDate.now(),
            null,
            TimeMode.ANYTIME,
            null,
            null,
            true
        );
    }

    private void stubCategoryAndSave() {
        when(categoryRepository.findByIdAndOwnerId(CATEGORY_ID, OWNER_ID)).thenReturn(Optional.of(category));
        when(taskRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.getReferenceById(anyLong())).thenReturn(null);
    }

    @Test
    void shortTextResponseIsOptional() {
        stubCategoryAndSave();
        TaskRequest request = requestWithResponseType(ResponseType.TEXT, "");

        TaskResponse response = taskService.createTask(OWNER_ID, request);

        assertThat(response.responseType()).isEqualTo(ResponseType.TEXT);
        assertThat(response.responseNote()).isNull();
        assertThat(response.textMaxLength()).isEqualTo(25);
    }

    @Test
    void shortTextResponseAcceptsExactly25Characters() {
        stubCategoryAndSave();
        String twentyFiveChars = "1234567890123456789012345";
        assertThat(twentyFiveChars).hasSize(25);
        TaskRequest request = requestWithResponseType(ResponseType.TEXT, twentyFiveChars);

        TaskResponse response = taskService.createTask(OWNER_ID, request);

        assertThat(response.responseNote()).isEqualTo(twentyFiveChars);
    }

    @Test
    void shortTextResponseRejectsMoreThan25Characters() {
        when(categoryRepository.findByIdAndOwnerId(CATEGORY_ID, OWNER_ID)).thenReturn(Optional.of(category));
        String twentySixChars = "12345678901234567890123456";
        assertThat(twentySixChars).hasSize(26);
        TaskRequest request = requestWithResponseType(ResponseType.TEXT, twentySixChars);

        assertThatThrownBy(() -> taskService.createTask(OWNER_ID, request))
            .isInstanceOf(InvalidTaskConfigurationException.class);
    }

    @Test
    void numericMinGreaterThanMaxIsRejected() {
        when(categoryRepository.findByIdAndOwnerId(CATEGORY_ID, OWNER_ID)).thenReturn(Optional.of(category));
        TaskRequest request = new TaskRequest(
            "Record temperature",
            null,
            CATEGORY_ID,
            null,
            true,
            null,
            ResponseType.NUMERIC,
            null,
            "F",
            50.0,
            10.0,
            null,
            CompletionType.SINGLE,
            null,
            ScheduleType.EVERY_DAY,
            null,
            LocalDate.now(),
            null,
            TimeMode.ANYTIME,
            null,
            null,
            true
        );

        assertThatThrownBy(() -> taskService.createTask(OWNER_ID, request))
            .isInstanceOf(InvalidTaskConfigurationException.class);
    }

    @Test
    void responseTypeRoundTripsThroughUpdate() {
        when(categoryRepository.findByIdAndOwnerId(CATEGORY_ID, OWNER_ID)).thenReturn(Optional.of(category));
        when(taskRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var task = new com.nforce.retailops.entity.Task();
        ReflectionTestUtils.setField(task, "id", 9L);
        task.setResponseType(ResponseType.YES_NO);
        when(taskRepository.findByIdAndOwnerId(9L, OWNER_ID)).thenReturn(Optional.of(task));

        TaskRequest request = requestWithResponseType(ResponseType.NUMERIC, null);
        TaskResponse response = taskService.updateTask(OWNER_ID, 9L, request);

        assertThat(response.responseType()).isEqualTo(ResponseType.NUMERIC);
    }

    @Test
    void newTaskWithNoExplicitOrderIsAppendedToEndOfCategory() {
        stubCategoryAndSave();
        when(taskRepository.countByCategoryId(CATEGORY_ID)).thenReturn(3);

        TaskResponse response = taskService.createTask(OWNER_ID, requestWithResponseType(ResponseType.YES_NO, null));

        assertThat(response.displayOrder()).isEqualTo(3);
    }

    @Test
    void explicitDisplayOrderOverridesAutoAssignment() {
        stubCategoryAndSave();
        TaskRequest request = new TaskRequest(
            "Clean counter", null, CATEGORY_ID, 7, true, null,
            ResponseType.YES_NO, null, null, null, null, null,
            CompletionType.SINGLE, null, ScheduleType.EVERY_DAY, null,
            LocalDate.now(), null, TimeMode.ANYTIME, null, null, true
        );

        TaskResponse response = taskService.createTask(OWNER_ID, request);

        assertThat(response.displayOrder()).isEqualTo(7);
    }

    @Test
    void editingATaskWithoutTouchingOrderPreservesItsExistingOrder() {
        when(categoryRepository.findByIdAndOwnerId(CATEGORY_ID, OWNER_ID)).thenReturn(Optional.of(category));
        when(taskRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        var task = new com.nforce.retailops.entity.Task();
        ReflectionTestUtils.setField(task, "id", 9L);
        task.setDisplayOrder(4);
        when(taskRepository.findByIdAndOwnerId(9L, OWNER_ID)).thenReturn(Optional.of(task));

        TaskResponse response = taskService.updateTask(OWNER_ID, 9L, requestWithResponseType(ResponseType.YES_NO, null));

        assertThat(response.displayOrder()).isEqualTo(4);
    }

    // Proves the fix from the concurrency review: the in-memory pre-check in
    // submitResponse cannot stop two concurrent transactions from both passing it before
    // either commits, so the actual guarantee is the partial unique index (V19) -- a
    // violation surfaces here as DataIntegrityViolationException, which must be
    // translated to the same TaskAlreadyCompletedException the pre-check throws.
    @Test
    void submitResponseTranslatesADatabaseConstraintViolationIntoTaskAlreadyCompleted() {
        Long taskId = 11L;
        var task = new Task();
        ReflectionTestUtils.setField(task, "id", taskId);
        task.setActive(true);
        task.setAppliesToAllStores(true);
        task.setResponseType(ResponseType.YES_NO);
        task.setCompletionType(CompletionType.SINGLE);

        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));
        // The pre-check itself sees no active response yet -- this is exactly the race:
        // another transaction's row is about to (or just did) commit past this same check.
        when(taskResponseEntryRepository.findByTaskIdAndStoreIdAndResponseDateAndActiveTrue(anyLong(), anyLong(), any()))
            .thenReturn(List.of());
        when(taskResponseEntryRepository.save(any()))
            .thenThrow(new DataIntegrityViolationException("duplicate key value violates unique constraint"));

        TaskResponseSubmitRequest request = new TaskResponseSubmitRequest(1L, true, null, null);

        assertThatThrownBy(() -> taskService.submitResponse(42L, taskId, request))
            .isInstanceOf(TaskAlreadyCompletedException.class);
    }

    @Test
    void deleteTaskIsRejectedWhenTaskHasCheckedHistory() {
        Long taskId = 9L;
        var task = new Task();
        ReflectionTestUtils.setField(task, "id", taskId);
        when(taskRepository.findByIdAndOwnerId(taskId, OWNER_ID)).thenReturn(Optional.of(task));
        when(taskResponseEntryRepository.existsByTaskId(taskId)).thenReturn(true);

        assertThatThrownBy(() -> taskService.deleteTask(OWNER_ID, taskId))
            .isInstanceOf(TaskHasHistoryException.class);

        verify(taskRepository, never()).delete(any());
    }

    @Test
    void deleteTaskProceedsWhenTaskHasNoHistory() {
        Long taskId = 9L;
        var task = new Task();
        ReflectionTestUtils.setField(task, "id", taskId);
        when(taskRepository.findByIdAndOwnerId(taskId, OWNER_ID)).thenReturn(Optional.of(task));
        when(taskResponseEntryRepository.existsByTaskId(taskId)).thenReturn(false);

        taskService.deleteTask(OWNER_ID, taskId);

        verify(taskRepository).delete(task);
    }
}
