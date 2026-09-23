package com.nforce.retailops.service;

import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.exception.TaskMakeupLinkNotEligibleException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.TaskMakeupLinkRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import com.nforce.retailops.repository.UserRepository;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskMakeupLinkServiceTest {

    private static final Long EMPLOYEE_ID = 42L;
    private static final Long STORE_ID = 7L;
    private static final Long TASK_ID = 11L;

    @Mock
    private TaskRepository taskRepository;
    @Mock
    private TaskResponseEntryRepository taskResponseEntryRepository;
    @Mock
    private TaskMakeupLinkRepository taskMakeupLinkRepository;
    @Mock
    private StoreOwnerRepository storeOwnerRepository;
    @Mock
    private StoreRepository storeRepository;
    @Mock
    private StoreEmployeeRepository storeEmployeeRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private UserProfileService userProfileService;

    @InjectMocks
    private TaskMakeupLinkService taskMakeupLinkService;

    private Task missableTask(LocalDate startDate) {
        Task task = new Task();
        ReflectionTestUtils.setField(task, "id", TASK_ID);
        task.setAppliesToAllStores(true);
        task.setStartDate(startDate);
        return task;
    }

    // Proves the same fix TaskServiceTest pins down for TaskService.writeResponse: the
    // in-memory "no active response yet" pre-check can't stop two concurrent moveToDate
    // calls from both passing it before either commits, so the actual guarantee is the
    // partial unique index (idx_task_makeup_links_pending, V65) -- a violation surfaces
    // here as DataIntegrityViolationException and must translate to
    // TaskMakeupLinkNotEligibleException (409), the same exception a pre-check failure
    // throws, rather than leaking a raw persistence exception.
    @Test
    void moveToDateTranslatesADatabaseConstraintViolationIntoTaskMakeupLinkNotEligible() {
        LocalDate today = LocalDate.now();
        LocalDate missedDate = today.minusDays(1);
        doNothing().when(userProfileService).requireAssignedStore(EMPLOYEE_ID, STORE_ID);
        when(taskRepository.findById(TASK_ID)).thenReturn(Optional.of(missableTask(missedDate.minusDays(5))));
        when(taskResponseEntryRepository.findByTaskIdAndStoreIdAndResponseDateAndActiveTrue(TASK_ID, STORE_ID, missedDate))
            .thenReturn(List.of());
        when(storeRepository.getReferenceById(STORE_ID)).thenReturn(new Store());
        when(userRepository.getReferenceById(EMPLOYEE_ID)).thenReturn(null);
        when(taskMakeupLinkRepository.save(any()))
            .thenThrow(new DataIntegrityViolationException("duplicate key value violates unique constraint"));

        assertThatThrownBy(() -> taskMakeupLinkService.moveToDate(EMPLOYEE_ID, TASK_ID, STORE_ID, missedDate, today))
            .isInstanceOf(TaskMakeupLinkNotEligibleException.class);
    }

    @Test
    void moveToDateRejectsAPastTargetDate() {
        LocalDate today = LocalDate.now();
        LocalDate missedDate = today.minusDays(1);
        doNothing().when(userProfileService).requireAssignedStore(EMPLOYEE_ID, STORE_ID);

        assertThatThrownBy(() -> taskMakeupLinkService.moveToDate(EMPLOYEE_ID, TASK_ID, STORE_ID, missedDate, today.minusDays(1)))
            .isInstanceOf(TaskMakeupLinkNotEligibleException.class);
    }

    @Test
    void moveToDateRejectsATargetDateBeyondSevenDaysOut() {
        LocalDate today = LocalDate.now();
        LocalDate missedDate = today.minusDays(1);
        doNothing().when(userProfileService).requireAssignedStore(EMPLOYEE_ID, STORE_ID);

        assertThatThrownBy(() -> taskMakeupLinkService.moveToDate(EMPLOYEE_ID, TASK_ID, STORE_ID, missedDate, today.plusDays(8)))
            .isInstanceOf(TaskMakeupLinkNotEligibleException.class);
    }

    @Test
    void moveToDateAcceptsTheSevenDayBoundary() {
        LocalDate today = LocalDate.now();
        LocalDate missedDate = today.minusDays(1);
        doNothing().when(userProfileService).requireAssignedStore(EMPLOYEE_ID, STORE_ID);
        when(taskRepository.findById(TASK_ID)).thenReturn(Optional.of(missableTask(missedDate.minusDays(5))));
        when(taskResponseEntryRepository.findByTaskIdAndStoreIdAndResponseDateAndActiveTrue(TASK_ID, STORE_ID, missedDate))
            .thenReturn(List.of());
        when(storeRepository.getReferenceById(STORE_ID)).thenReturn(new Store());
        when(userRepository.getReferenceById(EMPLOYEE_ID)).thenReturn(null);
        when(taskMakeupLinkRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = taskMakeupLinkService.moveToDate(EMPLOYEE_ID, TASK_ID, STORE_ID, missedDate, today.plusDays(7));

        assertThat(response.targetDate()).isEqualTo(today.plusDays(7));
        assertThat(response.status()).isEqualTo("PENDING");
    }

    @Test
    void moveToDateRejectsWhenAnActiveResponseAlreadyExistsForThatDay() {
        LocalDate today = LocalDate.now();
        LocalDate missedDate = today.minusDays(1);
        doNothing().when(userProfileService).requireAssignedStore(EMPLOYEE_ID, STORE_ID);
        when(taskRepository.findById(TASK_ID)).thenReturn(Optional.of(missableTask(missedDate.minusDays(5))));
        when(taskResponseEntryRepository.findByTaskIdAndStoreIdAndResponseDateAndActiveTrue(TASK_ID, STORE_ID, missedDate))
            .thenReturn(List.of(new com.nforce.retailops.entity.TaskResponseEntry()));

        assertThatThrownBy(() -> taskMakeupLinkService.moveToDate(EMPLOYEE_ID, TASK_ID, STORE_ID, missedDate, today))
            .isInstanceOf(TaskMakeupLinkNotEligibleException.class);
    }

    @Test
    void requireMoveTargetingAcceptsAFulfilledMoveNotOnlyPending() {
        LocalDate today = LocalDate.now();
        LocalDate missedDate = today.minusDays(1);
        var fulfilledMove = new com.nforce.retailops.entity.TaskMakeupLink();
        ReflectionTestUtils.setField(fulfilledMove, "linkedDate", today);
        when(taskMakeupLinkRepository.findByTaskIdAndStoreIdAndPastDateAndStatusIn(
            eq(TASK_ID), eq(STORE_ID), eq(missedDate), any()))
            .thenReturn(List.of(fulfilledMove));

        // Must not throw -- a MULTIPLE moved unit's second distinct responder, or a
        // flag -> resubmit cycle, must still be able to submit after the move already
        // went FULFILLED from an earlier response.
        taskMakeupLinkService.requireMoveTargeting(TASK_ID, STORE_ID, missedDate, today);
    }
}
