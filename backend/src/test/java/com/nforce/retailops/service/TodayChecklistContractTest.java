package com.nforce.retailops.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.nforce.retailops.dto.TodayChecklistResponse;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;

/**
 * Empirically checks the GET /api/me/tasks/today response contract: every
 * checklist item must always carry a (possibly empty) "responses" array and a
 * "canUndo" boolean, even when no employee has answered the task yet.
 */
@ExtendWith(MockitoExtension.class)
class TodayChecklistContractTest {

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

    private TaskService taskService;

    @BeforeEach
    void setUp() {
        taskService = new TaskService(
            taskRepository, categoryRepository, storeOwnerRepository, storeRepository,
            userRepository, userProfileService, taskResponseEntryRepository
        );
    }

    @Test
    void checklistItemWithNoResponsesStillCarriesAnEmptyResponsesArrayAndCanUndoFalse() throws Exception {
        Long employeeId = 42L;
        Long storeId = 3L;
        Long ownerId = 1L;

        doNothing().when(userProfileService).requireAssignedStore(employeeId, storeId);

        StoreOwner storeOwner = new StoreOwner();
        User owner = new User();
        ReflectionTestUtils.setField(owner, "id", ownerId);
        ReflectionTestUtils.setField(storeOwner, "owner", owner);
        when(storeOwnerRepository.findByStoreId(storeId)).thenReturn(Optional.of(storeOwner));

        Category category = new Category();
        ReflectionTestUtils.setField(category, "id", 5L);
        ReflectionTestUtils.setField(category, "name", "Opening");

        Task task = new Task();
        ReflectionTestUtils.setField(task, "id", 100L);
        task.setName("Unlock front door");
        task.setCategory(category);
        task.setResponseType(ResponseType.YES_NO);
        task.setCompletionType(CompletionType.SINGLE);
        task.setScheduleType(ScheduleType.EVERY_DAY);
        task.setTimeMode(TimeMode.ANYTIME);
        task.setStartDate(LocalDate.now().minusDays(1));
        task.setActive(true);

        when(taskRepository.findActiveForStoreAndDate(anyLong(), anyLong(), org.mockito.ArgumentMatchers.any()))
            .thenReturn(List.of(task));
        // No active responses at all for this task/store/day.
        when(taskResponseEntryRepository.findByTaskIdInAndStoreIdAndResponseDateAndActiveTrue(
            org.mockito.ArgumentMatchers.anyList(), anyLong(), org.mockito.ArgumentMatchers.any()))
            .thenReturn(List.of());

        TodayChecklistResponse result = taskService.getTodayChecklistForEmployee(employeeId, storeId);

        assertThat(result.categories()).hasSize(1);
        var item = result.categories().get(0).tasks().get(0);
        assertThat(item.responses()).isNotNull().isEmpty();
        assertThat(item.canUndo()).isFalse();

        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        String json = mapper.writeValueAsString(result);
        assertThat(json).contains("\"responses\":[]");
        assertThat(json).contains("\"canUndo\":false");
    }
}
