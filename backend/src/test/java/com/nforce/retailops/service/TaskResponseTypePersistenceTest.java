package com.nforce.retailops.service;

import com.nforce.retailops.dto.TaskRequest;
import com.nforce.retailops.dto.TaskResponse;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.CompletionType;
import com.nforce.retailops.entity.ResponseType;
import com.nforce.retailops.entity.ScheduleType;
import com.nforce.retailops.entity.TimeMode;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidTaskConfigurationException;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Exercises TaskService against a real (H2, Postgres-compatible) database rather than
 * mocks, to prove Response Type genuinely survives a save + reload round trip through
 * JPA/Hibernate -- not just held in memory.
 */
@SpringBootTest
@ActiveProfiles("test")
class TaskResponseTypePersistenceTest {

    @Autowired
    private TaskService taskService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    private Long ownerId;
    private Long categoryId;

    @BeforeEach
    @Transactional
    void setUp() {
        User owner = new User();
        owner.setEmail("owner-" + System.nanoTime() + "@nforce.test");
        owner.setPasswordHash("irrelevant-hash");
        owner.setFullName("Test Owner");
        owner = userRepository.save(owner);
        ownerId = owner.getId();

        Category category = new Category();
        category.setOwner(owner);
        category.setName("Cleaning");
        category.setDisplayOrder(1);
        category = categoryRepository.save(category);
        categoryId = category.getId();
    }

    private TaskRequest baseRequest(ResponseType responseType, String responseNote) {
        return new TaskRequest(
            "Wipe counters",
            null,
            categoryId,
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

    @Test
    @Transactional
    void yesNoResponseTypeSurvivesReload() {
        TaskResponse created = taskService.createTask(ownerId, baseRequest(ResponseType.YES_NO, null));

        TaskResponse reloaded = taskService.getTask(ownerId, created.id());

        assertThat(reloaded.responseType()).isEqualTo(ResponseType.YES_NO);
    }

    @Test
    @Transactional
    void doneCheckboxResponseTypeSurvivesReload() {
        TaskResponse created = taskService.createTask(ownerId, baseRequest(ResponseType.DONE_NOT_DONE, null));

        TaskResponse reloaded = taskService.getTask(ownerId, created.id());

        assertThat(reloaded.responseType()).isEqualTo(ResponseType.DONE_NOT_DONE);
    }

    @Test
    @Transactional
    void numericResponseTypeAndBoundsSurviveReload() {
        TaskRequest request = new TaskRequest(
            "Record temperature", null, categoryId, null, true, null,
            ResponseType.NUMERIC, null, "F", 10.0, 40.0, null,
            CompletionType.SINGLE, null, ScheduleType.EVERY_DAY, null,
            LocalDate.now(), null, TimeMode.ANYTIME, null, null, true
        );

        TaskResponse created = taskService.createTask(ownerId, request);
        TaskResponse reloaded = taskService.getTask(ownerId, created.id());

        assertThat(reloaded.responseType()).isEqualTo(ResponseType.NUMERIC);
        assertThat(reloaded.numericMin()).isEqualTo(10.0);
        assertThat(reloaded.numericMax()).isEqualTo(40.0);
        assertThat(reloaded.numericUnit()).isEqualTo("F");
    }

    @Test
    @Transactional
    void shortTextResponseTypeWithEmptyValueSurvivesReload() {
        TaskResponse created = taskService.createTask(ownerId, baseRequest(ResponseType.TEXT, ""));

        TaskResponse reloaded = taskService.getTask(ownerId, created.id());

        assertThat(reloaded.responseType()).isEqualTo(ResponseType.TEXT);
        assertThat(reloaded.responseNote()).isNull();
        assertThat(reloaded.textMaxLength()).isEqualTo(25);
    }

    @Test
    @Transactional
    void shortTextResponseTypeWith25CharactersSurvivesReload() {
        String text = "abcdefghijklmnopqrstuvwxy"; // exactly 25 characters
        assertThat(text).hasSize(25);

        TaskResponse created = taskService.createTask(ownerId, baseRequest(ResponseType.TEXT, text));
        TaskResponse reloaded = taskService.getTask(ownerId, created.id());

        assertThat(reloaded.responseNote()).isEqualTo(text);
    }

    @Test
    @Transactional
    void shortTextResponseTypeRejects26CharactersBeforePersisting() {
        String text = "abcdefghijklmnopqrstuvwxyz"; // 26 characters
        assertThat(text).hasSize(26);

        assertThatThrownBy(() -> taskService.createTask(ownerId, baseRequest(ResponseType.TEXT, text)))
            .isInstanceOf(InvalidTaskConfigurationException.class);
    }

    @Test
    @Transactional
    void editingResponseTypeFromYesNoToNumberPersistsAndSurvivesReload() {
        TaskResponse created = taskService.createTask(ownerId, baseRequest(ResponseType.YES_NO, null));
        assertThat(created.responseType()).isEqualTo(ResponseType.YES_NO);

        TaskRequest editRequest = new TaskRequest(
            "Wipe counters", null, categoryId, null, true, null,
            ResponseType.NUMERIC, null, null, null, null, null,
            CompletionType.SINGLE, null, ScheduleType.EVERY_DAY, null,
            LocalDate.now(), null, TimeMode.ANYTIME, null, null, true
        );
        taskService.updateTask(ownerId, created.id(), editRequest);

        TaskResponse reloaded = taskService.getTask(ownerId, created.id());
        assertThat(reloaded.responseType()).isEqualTo(ResponseType.NUMERIC);
    }

    @Test
    @Transactional
    void deactivatingATaskPreservesItAndItsConfiguration() {
        TaskResponse created = taskService.createTask(ownerId, baseRequest(ResponseType.TEXT, "Checked"));

        TaskResponse deactivated = taskService.setActive(ownerId, created.id(), false);
        assertThat(deactivated.active()).isFalse();

        TaskResponse reloaded = taskService.getTask(ownerId, created.id());
        assertThat(reloaded.active()).isFalse();
        assertThat(reloaded.responseType()).isEqualTo(ResponseType.TEXT);
        assertThat(reloaded.responseNote()).isEqualTo("Checked");
    }

    @Test
    @Transactional
    void tasksCreatedWithoutExplicitOrderAreAppendedWithinTheirOwnCategory() {
        TaskResponse first = taskService.createTask(ownerId, baseRequest(ResponseType.YES_NO, null));
        TaskResponse second = taskService.createTask(ownerId, baseRequest(ResponseType.YES_NO, null));

        assertThat(first.displayOrder()).isEqualTo(0);
        assertThat(second.displayOrder()).isEqualTo(1);

        // A different category starts its own independent order sequence at 0 --
        // order is scoped per category, not globally per owner.
        Category otherCategory = new Category();
        otherCategory.setOwner(userRepository.getReferenceById(ownerId));
        otherCategory.setName("Opening");
        otherCategory.setDisplayOrder(2);
        otherCategory = categoryRepository.save(otherCategory);

        TaskRequest requestForOtherCategory = new TaskRequest(
            "Unlock store", null, otherCategory.getId(), null, true, null,
            ResponseType.YES_NO, null, null, null, null, null,
            CompletionType.SINGLE, null, ScheduleType.EVERY_DAY, null,
            LocalDate.now(), null, TimeMode.ANYTIME, null, null, true
        );
        TaskResponse thirdInOtherCategory = taskService.createTask(ownerId, requestForOtherCategory);

        assertThat(thirdInOtherCategory.displayOrder()).isEqualTo(0);
    }

    @Test
    @Transactional
    void adminCanReorderATaskAndTheChangePersists() {
        TaskResponse taskC = taskService.createTask(ownerId, baseRequest(ResponseType.YES_NO, null));
        assertThat(taskC.displayOrder()).isEqualTo(0);

        TaskRequest moveToFrontRequest = new TaskRequest(
            "Wipe counters", null, categoryId, 0, true, null,
            ResponseType.YES_NO, null, null, null, null, null,
            CompletionType.SINGLE, null, ScheduleType.EVERY_DAY, null,
            LocalDate.now(), null, TimeMode.ANYTIME, null, null, true
        );
        taskService.updateTask(ownerId, taskC.id(), moveToFrontRequest);

        TaskResponse reloaded = taskService.getTask(ownerId, taskC.id());
        assertThat(reloaded.displayOrder()).isEqualTo(0);
    }

    @Test
    @Transactional
    void deactivatingATaskDoesNotResetItsDisplayOrder() {
        TaskRequest requestWithExplicitOrder = new TaskRequest(
            "Wipe counters", null, categoryId, 9, true, null,
            ResponseType.YES_NO, null, null, null, null, null,
            CompletionType.SINGLE, null, ScheduleType.EVERY_DAY, null,
            LocalDate.now(), null, TimeMode.ANYTIME, null, null, true
        );
        TaskResponse created = taskService.createTask(ownerId, requestWithExplicitOrder);
        assertThat(created.displayOrder()).isEqualTo(9);

        taskService.setActive(ownerId, created.id(), false);
        TaskResponse reactivated = taskService.setActive(ownerId, created.id(), true);

        assertThat(reactivated.displayOrder()).isEqualTo(9);
        assertThat(reactivated.active()).isTrue();
    }

    private TaskRequest requestWithOrder(int displayOrder) {
        return new TaskRequest(
            "Task", null, categoryId, displayOrder, true, null,
            ResponseType.YES_NO, null, null, null, null, null,
            CompletionType.SINGLE, null, ScheduleType.EVERY_DAY, null,
            LocalDate.now(), null, TimeMode.ANYTIME, null, null, true
        );
    }

    @Test
    @Transactional
    void listTasksOrdersWithinACategoryByDisplayOrderAscending() {
        TaskResponse taskD = taskService.createTask(ownerId, requestWithOrder(4));
        TaskResponse taskB = taskService.createTask(ownerId, requestWithOrder(2));
        TaskResponse taskA = taskService.createTask(ownerId, requestWithOrder(1));
        TaskResponse taskC = taskService.createTask(ownerId, requestWithOrder(3));

        List<TaskResponse> tasks = taskService.listTasks(ownerId);

        // A task with displayOrder = 4 must not appear before tasks with lower orders,
        // even though it was created (and thus has the newest createdAt) first.
        assertThat(tasks).extracting(TaskResponse::id)
            .containsExactly(taskA.id(), taskB.id(), taskC.id(), taskD.id());
    }

    @Test
    @Transactional
    void editingDisplayOrderChangesListTasksPositionOnNextFetch() {
        TaskResponse taskA = taskService.createTask(ownerId, requestWithOrder(1));
        TaskResponse taskB = taskService.createTask(ownerId, requestWithOrder(2));
        TaskResponse taskC = taskService.createTask(ownerId, requestWithOrder(3));
        TaskResponse taskD = taskService.createTask(ownerId, requestWithOrder(4));

        assertThat(taskService.listTasks(ownerId)).extracting(TaskResponse::id)
            .containsExactly(taskA.id(), taskB.id(), taskC.id(), taskD.id());

        taskService.updateTask(ownerId, taskD.id(), requestWithOrder(1));

        assertThat(taskService.listTasks(ownerId)).extracting(TaskResponse::id)
            .containsExactly(taskD.id(), taskA.id(), taskB.id(), taskC.id());

        taskService.updateTask(ownerId, taskD.id(), requestWithOrder(10));

        assertThat(taskService.listTasks(ownerId)).extracting(TaskResponse::id)
            .containsExactly(taskA.id(), taskB.id(), taskC.id(), taskD.id());
    }

    @Test
    @Transactional
    void tasksWithTheSameDisplayOrderAreOrderedDeterministicallyNotRandomly() {
        TaskResponse first = taskService.createTask(ownerId, requestWithOrder(5));
        TaskResponse second = taskService.createTask(ownerId, requestWithOrder(5));

        List<Long> firstFetch = taskService.listTasks(ownerId).stream().map(TaskResponse::id).toList();
        List<Long> secondFetch = taskService.listTasks(ownerId).stream().map(TaskResponse::id).toList();

        // Re-fetching must not shuffle tasks that share a display order.
        assertThat(firstFetch).containsExactlyElementsOf(secondFetch);
        assertThat(firstFetch).containsExactlyInAnyOrder(first.id(), second.id());
    }

    @Test
    @Transactional
    void editingATaskIntoATieMovesItAheadOfTheUntouchedTaskItTied() {
        TaskResponse taskA = taskService.createTask(ownerId, requestWithOrder(1));
        TaskResponse taskD = taskService.createTask(ownerId, requestWithOrder(4));

        // Editing D to the same order A already holds is the exact scenario the Final
        // Acceptance Test exercises: the just-edited task must move ahead of the tie.
        taskService.updateTask(ownerId, taskD.id(), requestWithOrder(1));

        assertThat(taskService.listTasks(ownerId)).extracting(TaskResponse::id)
            .containsExactly(taskD.id(), taskA.id());
    }

    @Test
    @Transactional
    void listTasksOrdersByCategoryOrderBeforeTaskDisplayOrder() {
        Category earlierCategory = new Category();
        earlierCategory.setOwner(userRepository.getReferenceById(ownerId));
        earlierCategory.setName("Opening");
        earlierCategory.setDisplayOrder(0); // lower than the "Cleaning" category set up in @BeforeEach (1)
        earlierCategory = categoryRepository.save(earlierCategory);

        TaskRequest requestInEarlierCategory = new TaskRequest(
            "Unlock store", null, earlierCategory.getId(), 99, true, null,
            ResponseType.YES_NO, null, null, null, null, null,
            CompletionType.SINGLE, null, ScheduleType.EVERY_DAY, null,
            LocalDate.now(), null, TimeMode.ANYTIME, null, null, true
        );
        TaskResponse taskInEarlierCategory = taskService.createTask(ownerId, requestInEarlierCategory);
        TaskResponse taskInLaterCategory = taskService.createTask(ownerId, requestWithOrder(1));

        List<TaskResponse> tasks = taskService.listTasks(ownerId);

        // Even with a much higher displayOrder (99), the task in the earlier-ordered
        // category still comes first -- category order takes priority.
        assertThat(tasks).extracting(TaskResponse::id)
            .containsExactly(taskInEarlierCategory.id(), taskInLaterCategory.id());
    }
}
