package com.nforce.retailops.service;

import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CategoryServiceActiveCascadeTest {

    private static final Long OWNER_ID = 1L;
    private static final Long CATEGORY_ID = 5L;

    @Mock
    private CategoryRepository categoryRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TaskRepository taskRepository;

    @InjectMocks
    private CategoryService categoryService;

    private Category category;

    @BeforeEach
    void setUp() {
        category = new Category();
        ReflectionTestUtils.setField(category, "id", CATEGORY_ID);
        category.setName("Cleaning");
        when(categoryRepository.findByIdAndOwnerId(CATEGORY_ID, OWNER_ID)).thenReturn(Optional.of(category));
        when(categoryRepository.save(category)).thenReturn(category);
    }

    private Task task(long id, boolean active) {
        Task task = new Task();
        ReflectionTestUtils.setField(task, "id", id);
        task.setActive(active);
        return task;
    }

    @Test
    void deactivatingACategoryDeactivatesAllOfItsTasks() {
        Task activeTask = task(10L, true);
        Task alreadyInactiveTask = task(11L, false);
        when(taskRepository.findByCategoryId(CATEGORY_ID)).thenReturn(List.of(activeTask, alreadyInactiveTask));

        categoryService.setActive(OWNER_ID, CATEGORY_ID, false);

        assertThat(category.isActive()).isFalse();
        assertThat(activeTask.isActive()).isFalse();
        assertThat(alreadyInactiveTask.isActive()).isFalse();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Task>> savedTasks = ArgumentCaptor.forClass(List.class);
        verify(taskRepository).saveAll(savedTasks.capture());
        assertThat(savedTasks.getValue()).containsExactly(activeTask, alreadyInactiveTask);
    }

    @Test
    void activatingACategoryActivatesAllOfItsTasks() {
        Task inactiveTask = task(10L, false);
        when(taskRepository.findByCategoryId(CATEGORY_ID)).thenReturn(List.of(inactiveTask));

        categoryService.setActive(OWNER_ID, CATEGORY_ID, true);

        assertThat(category.isActive()).isTrue();
        assertThat(inactiveTask.isActive()).isTrue();
        verify(taskRepository).saveAll(anyList());
    }
}
