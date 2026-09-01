package com.nforce.retailops.service;

import com.nforce.retailops.dto.CategoryChecklistResponse;
import com.nforce.retailops.dto.TaskChecklistItemResponse;
import com.nforce.retailops.dto.TaskRequest;
import com.nforce.retailops.dto.TaskResponse;
import com.nforce.retailops.dto.TaskResponseStateResponse;
import com.nforce.retailops.dto.TaskResponseSubmitRequest;
import com.nforce.retailops.dto.TodayChecklistResponse;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidTaskResponseException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.exception.TaskAlreadyCompletedException;
import com.nforce.retailops.exception.TaskNotFoundException;
import com.nforce.retailops.exception.UnauthorizedTaskResponseActionException;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
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
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Exercises TaskService's employee response submit/undo flow against a real (H2,
 * Postgres-compatible) database, the same way TaskResponseTypePersistenceTest proves
 * Task configuration survives a save + reload round trip through JPA/Hibernate.
 */
@SpringBootTest
@ActiveProfiles("test")
class TaskResponsePersistenceTest {

    @Autowired
    private TaskService taskService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private CategoryRepository categoryRepository;
    @Autowired
    private StoreRepository storeRepository;
    @Autowired
    private StoreOwnerRepository storeOwnerRepository;
    @Autowired
    private StoreEmployeeRepository storeEmployeeRepository;
    @Autowired
    private TaskResponseEntryRepository taskResponseEntryRepository;

    private Long ownerId;
    private Long categoryId;
    private Long storeId;
    private Long employee1Id;
    private Long employee2Id;

    @BeforeEach
    @Transactional
    void setUp() {
        User owner = saveUser("owner");
        ownerId = owner.getId();

        Category category = new Category();
        category.setOwner(owner);
        category.setName("Cleaning");
        category.setDisplayOrder(1);
        category = categoryRepository.save(category);
        categoryId = category.getId();

        Store store = saveStore(90001L + System.nanoTime() % 1000);
        storeId = store.getId();
        linkOwnerToStore(owner, store);

        User employee1 = saveUser("employee1");
        User employee2 = saveUser("employee2");
        employee1Id = employee1.getId();
        employee2Id = employee2.getId();
        saveStoreEmployee(employee1, owner, store);
        saveStoreEmployee(employee2, owner, store);
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
        storeEmployee.setGender("Male");
        storeEmployee.setStores(new HashSet<>(Set.of(stores)));
        storeEmployeeRepository.save(storeEmployee);
    }

    private TaskRequest taskRequest(ResponseType responseType, CompletionType completionType, boolean appliesToAllStores, List<Long> storeIds) {
        return new TaskRequest(
            "Wipe counters",
            null,
            categoryId,
            null,
            appliesToAllStores,
            storeIds,
            responseType,
            responseType == ResponseType.TEXT ? "" : null,
            null,
            null,
            null,
            null,
            completionType,
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

    private Long createTask(ResponseType responseType, CompletionType completionType) {
        TaskResponse created = taskService.createTask(ownerId, taskRequest(responseType, completionType, true, null));
        return created.id();
    }

    private TaskChecklistItemResponse checklistItem(Long employeeId, Long taskId) {
        TodayChecklistResponse checklist = taskService.getTodayChecklistForEmployee(employeeId, storeId);
        return checklist.categories().stream()
            .flatMap(category -> category.tasks().stream())
            .filter(item -> item.id().equals(taskId))
            .findFirst()
            .orElseThrow();
    }

    // 1. YES_NO submission persists and appears in today's checklist.
    @Test
    @Transactional
    void yesNoSubmissionPersistsAndAppearsInTodaysChecklist() {
        Long taskId = createTask(ResponseType.YES_NO, CompletionType.SINGLE);

        TaskResponseStateResponse state = taskService.submitResponse(
            employee1Id, taskId, new TaskResponseSubmitRequest(storeId, true, null, null));

        assertThat(state.responses()).hasSize(1);
        assertThat(state.responses().get(0).booleanValue()).isTrue();
        assertThat(state.canUndo()).isTrue();

        TaskChecklistItemResponse item = checklistItem(employee1Id, taskId);
        assertThat(item.responses()).hasSize(1);
        assertThat(item.responses().get(0).booleanValue()).isTrue();
        assertThat(item.responses().get(0).employeeUserId()).isEqualTo(employee1Id);
        assertThat(item.canUndo()).isTrue();
    }

    // 2. DONE_NOT_DONE submission persists.
    @Test
    @Transactional
    void doneNotDoneSubmissionPersists() {
        Long taskId = createTask(ResponseType.DONE_NOT_DONE, CompletionType.SINGLE);

        TaskResponseStateResponse state = taskService.submitResponse(
            employee1Id, taskId, new TaskResponseSubmitRequest(storeId, true, null, null));

        assertThat(state.responses()).hasSize(1);
        assertThat(state.responses().get(0).booleanValue()).isTrue();

        TaskChecklistItemResponse item = checklistItem(employee1Id, taskId);
        assertThat(item.responses().get(0).booleanValue()).isTrue();
    }

    // 3. NUMERIC submission persists.
    @Test
    @Transactional
    void numericSubmissionPersists() {
        Long taskId = createTask(ResponseType.NUMERIC, CompletionType.SINGLE);

        TaskResponseStateResponse state = taskService.submitResponse(
            employee1Id, taskId, new TaskResponseSubmitRequest(storeId, null, 38.5, null));

        assertThat(state.responses()).hasSize(1);
        assertThat(state.responses().get(0).numericValue()).isEqualTo(38.5);

        TaskChecklistItemResponse item = checklistItem(employee1Id, taskId);
        assertThat(item.responses().get(0).numericValue()).isEqualTo(38.5);
    }

    // 4. TEXT submission persists.
    @Test
    @Transactional
    void textSubmissionPersists() {
        Long taskId = createTask(ResponseType.TEXT, CompletionType.SINGLE);

        TaskResponseStateResponse state = taskService.submitResponse(
            employee1Id, taskId, new TaskResponseSubmitRequest(storeId, null, null, "Temperature OK"));

        assertThat(state.responses()).hasSize(1);
        assertThat(state.responses().get(0).textValue()).isEqualTo("Temperature OK");

        TaskChecklistItemResponse item = checklistItem(employee1Id, taskId);
        assertThat(item.responses().get(0).textValue()).isEqualTo("Temperature OK");
    }

    // 5. Invalid response value/type is rejected.
    @Test
    @Transactional
    void invalidResponseValueIsRejected() {
        Long yesNoTaskId = createTask(ResponseType.YES_NO, CompletionType.SINGLE);
        Long numericTaskId = createTask(ResponseType.NUMERIC, CompletionType.SINGLE);
        Long textTaskId = createTask(ResponseType.TEXT, CompletionType.SINGLE);

        assertThatThrownBy(() -> taskService.submitResponse(
            employee1Id, yesNoTaskId, new TaskResponseSubmitRequest(storeId, null, 5.0, null)))
            .isInstanceOf(InvalidTaskResponseException.class);

        assertThatThrownBy(() -> taskService.submitResponse(
            employee1Id, numericTaskId, new TaskResponseSubmitRequest(storeId, true, null, null)))
            .isInstanceOf(InvalidTaskResponseException.class);

        assertThatThrownBy(() -> taskService.submitResponse(
            employee1Id, textTaskId, new TaskResponseSubmitRequest(storeId, null, null, null)))
            .isInstanceOf(InvalidTaskResponseException.class);
    }

    // 6. SINGLE: first active response blocks another employee.
    @Test
    @Transactional
    void singleFirstActiveResponseBlocksAnotherEmployee() {
        Long taskId = createTask(ResponseType.YES_NO, CompletionType.SINGLE);

        taskService.submitResponse(employee1Id, taskId, new TaskResponseSubmitRequest(storeId, true, null, null));

        assertThatThrownBy(() -> taskService.submitResponse(
            employee2Id, taskId, new TaskResponseSubmitRequest(storeId, true, null, null)))
            .isInstanceOf(TaskAlreadyCompletedException.class);
    }

    // 7. SINGLE: submitting employee can Undo.
    @Test
    @Transactional
    void singleSubmittingEmployeeCanUndo() {
        Long taskId = createTask(ResponseType.YES_NO, CompletionType.SINGLE);
        TaskResponseStateResponse submitted = taskService.submitResponse(
            employee1Id, taskId, new TaskResponseSubmitRequest(storeId, true, null, null));
        Long responseId = submitted.responses().get(0).id();

        TaskResponseStateResponse afterUndo = taskService.undoResponse(employee1Id, taskId, storeId, responseId);

        assertThat(afterUndo.responses()).isEmpty();
        assertThat(afterUndo.canUndo()).isFalse();
    }

    // 8. SINGLE: Undo preserves the database row and makes the task available again.
    @Test
    @Transactional
    void singleUndoPreservesRowAndReopensTask() {
        Long taskId = createTask(ResponseType.YES_NO, CompletionType.SINGLE);
        TaskResponseStateResponse submitted = taskService.submitResponse(
            employee1Id, taskId, new TaskResponseSubmitRequest(storeId, true, null, null));
        Long responseId = submitted.responses().get(0).id();

        taskService.undoResponse(employee1Id, taskId, storeId, responseId);

        Optional<TaskResponseEntry> preserved = taskResponseEntryRepository.findById(responseId);
        assertThat(preserved).isPresent();
        assertThat(preserved.get().isActive()).isFalse();
        assertThat(preserved.get().getUndoneAt()).isNotNull();
        assertThat(preserved.get().getValueBoolean()).isTrue();

        // The task is available again -- a new (or the same) employee can complete it.
        TaskResponseStateResponse resubmitted = taskService.submitResponse(
            employee2Id, taskId, new TaskResponseSubmitRequest(storeId, false, null, null));
        assertThat(resubmitted.responses()).hasSize(1);
        assertThat(resubmitted.responses().get(0).employeeUserId()).isEqualTo(employee2Id);

        // Both the undone row and the new active row still exist -- history preserved.
        assertThat(taskResponseEntryRepository.findAll().stream()
            .filter(entry -> entry.getTask().getId().equals(taskId))
            .count()).isEqualTo(2);
    }

    // 9. SINGLE: another employee cannot Undo someone else's response.
    @Test
    @Transactional
    void anotherEmployeeCannotUndoSomeoneElsesResponse() {
        Long taskId = createTask(ResponseType.YES_NO, CompletionType.SINGLE);
        TaskResponseStateResponse submitted = taskService.submitResponse(
            employee1Id, taskId, new TaskResponseSubmitRequest(storeId, true, null, null));
        Long responseId = submitted.responses().get(0).id();

        assertThatThrownBy(() -> taskService.undoResponse(employee2Id, taskId, storeId, responseId))
            .isInstanceOf(UnauthorizedTaskResponseActionException.class);

        // The response must remain untouched by the rejected attempt.
        TaskResponseEntry unchanged = taskResponseEntryRepository.findById(responseId).orElseThrow();
        assertThat(unchanged.isActive()).isTrue();
        assertThat(unchanged.getUndoneAt()).isNull();
    }

    // 10. MULTIPLE: different employees can respond.
    @Test
    @Transactional
    void multipleAllowsDifferentEmployeesToRespond() {
        Long taskId = createTask(ResponseType.YES_NO, CompletionType.MULTIPLE);

        taskService.submitResponse(employee1Id, taskId, new TaskResponseSubmitRequest(storeId, true, null, null));
        TaskResponseStateResponse afterSecond = taskService.submitResponse(
            employee2Id, taskId, new TaskResponseSubmitRequest(storeId, false, null, null));

        assertThat(afterSecond.responses()).hasSize(2);
        assertThat(afterSecond.responses()).extracting(r -> r.employeeUserId())
            .containsExactlyInAnyOrder(employee1Id, employee2Id);
    }

    // 11. MULTIPLE: same employee can submit repeatedly.
    @Test
    @Transactional
    void multipleAllowsSameEmployeeToSubmitRepeatedly() {
        Long taskId = createTask(ResponseType.NUMERIC, CompletionType.MULTIPLE);

        taskService.submitResponse(employee1Id, taskId, new TaskResponseSubmitRequest(storeId, null, 10.0, null));
        TaskResponseStateResponse afterSecond = taskService.submitResponse(
            employee1Id, taskId, new TaskResponseSubmitRequest(storeId, null, 20.0, null));

        assertThat(afterSecond.responses()).hasSize(2);
        assertThat(afterSecond.responses()).allMatch(r -> r.employeeUserId().equals(employee1Id));
        assertThat(afterSecond.responses()).extracting(r -> r.numericValue())
            .containsExactlyInAnyOrder(10.0, 20.0);
    }

    // 12a. Store assignment validation is enforced: an employee not assigned to the
    // store cannot submit a response for it.
    @Test
    @Transactional
    void submittingForAStoreTheEmployeeIsNotAssignedToIsRejected() {
        Long taskId = createTask(ResponseType.YES_NO, CompletionType.SINGLE);
        User unassignedEmployee = saveUser("unassigned");

        assertThatThrownBy(() -> taskService.submitResponse(
            unassignedEmployee.getId(), taskId, new TaskResponseSubmitRequest(storeId, true, null, null)))
            .isInstanceOf(StoreNotFoundException.class);
    }

    // 12b. Store assignment validation is enforced: a task not offered to the
    // employee's store cannot be responded to there, even though the employee is
    // genuinely assigned to that store.
    @Test
    @Transactional
    void submittingForATaskNotScopedToTheEmployeesStoreIsRejected() {
        Store otherStore = saveStore(90501L + System.nanoTime() % 1000);
        linkOwnerToStore(userRepository.getReferenceById(ownerId), otherStore);

        // Add the second store to employee1's existing assignment rather than creating
        // a second StoreEmployee row -- store_employees.user_id is unique per employee.
        StoreEmployee employee1Assignment = storeEmployeeRepository.findByEmployeeId(employee1Id).orElseThrow();
        employee1Assignment.getStores().add(otherStore);
        storeEmployeeRepository.save(employee1Assignment);

        // Task scoped only to the original store, not otherStore.
        TaskResponse created = taskService.createTask(
            ownerId, taskRequest(ResponseType.YES_NO, CompletionType.SINGLE, false, List.of(storeId)));

        assertThatThrownBy(() -> taskService.submitResponse(
            employee1Id, created.id(), new TaskResponseSubmitRequest(otherStore.getId(), true, null, null)))
            .isInstanceOf(TaskNotFoundException.class);
    }
}
