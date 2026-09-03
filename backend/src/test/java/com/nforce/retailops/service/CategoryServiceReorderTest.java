package com.nforce.retailops.service;

import com.nforce.retailops.dto.CategoryResponse;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.exception.InvalidCategoryOrderException;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CategoryServiceReorderTest {

    private static final Long OWNER_ID = 1L;

    @Mock
    private CategoryRepository categoryRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TaskRepository taskRepository;

    @InjectMocks
    private CategoryService categoryService;

    private Category category(long id, int displayOrder) {
        Category category = new Category();
        ReflectionTestUtils.setField(category, "id", id);
        category.setName("Category " + id);
        category.setDisplayOrder(displayOrder);
        return category;
    }

    @BeforeEach
    void setUp() {
        lenient().when(taskRepository.countByCategoryId(anyLong())).thenReturn(0);
    }

    @Test
    void reorderingAssignsDisplayOrderFromThePositionInOrderedIds() {
        Category first = category(1L, 0);
        Category second = category(2L, 1);
        Category third = category(3L, 2);
        when(categoryRepository.findByOwnerIdOrderByDisplayOrderAsc(OWNER_ID))
            .thenReturn(List.of(first, second, third));
        when(categoryRepository.findOwnerCategorySummaryRows(OWNER_ID)).thenReturn(List.of());

        categoryService.reorderCategories(OWNER_ID, List.of(3L, 1L, 2L));

        assertThat(third.getDisplayOrder()).isEqualTo(0);
        assertThat(first.getDisplayOrder()).isEqualTo(1);
        assertThat(second.getDisplayOrder()).isEqualTo(2);
        verify(categoryRepository).saveAll(anyCollection());
    }

    @Test
    void rejectsAnOrderedIdsListMissingOneOfTheOwnersCategories() {
        Category first = category(1L, 0);
        Category second = category(2L, 1);
        when(categoryRepository.findByOwnerIdOrderByDisplayOrderAsc(OWNER_ID))
            .thenReturn(List.of(first, second));

        assertThatThrownBy(() -> categoryService.reorderCategories(OWNER_ID, List.of(1L)))
            .isInstanceOf(InvalidCategoryOrderException.class);

        verify(categoryRepository, never()).saveAll(anyCollection());
    }

    @Test
    void rejectsAnOrderedIdsListWithADuplicate() {
        Category first = category(1L, 0);
        Category second = category(2L, 1);
        when(categoryRepository.findByOwnerIdOrderByDisplayOrderAsc(OWNER_ID))
            .thenReturn(List.of(first, second));

        assertThatThrownBy(() -> categoryService.reorderCategories(OWNER_ID, List.of(1L, 1L)))
            .isInstanceOf(InvalidCategoryOrderException.class);

        verify(categoryRepository, never()).saveAll(anyCollection());
    }

    @Test
    void rejectsAnOrderedIdsListContainingAForeignCategoryId() {
        Category first = category(1L, 0);
        Category second = category(2L, 1);
        when(categoryRepository.findByOwnerIdOrderByDisplayOrderAsc(OWNER_ID))
            .thenReturn(List.of(first, second));

        assertThatThrownBy(() -> categoryService.reorderCategories(OWNER_ID, List.of(1L, 999L)))
            .isInstanceOf(InvalidCategoryOrderException.class);

        verify(categoryRepository, never()).saveAll(anyCollection());
    }
}

