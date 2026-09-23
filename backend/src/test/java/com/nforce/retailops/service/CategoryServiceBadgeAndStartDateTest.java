package com.nforce.retailops.service;

import com.nforce.retailops.dto.CategoryRequest;
import com.nforce.retailops.dto.CategoryResponse;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CategoryServiceBadgeAndStartDateTest {

    private static final Long STORE_ID = 10L;
    private static final Long CATEGORY_ID = 100L;

    @Mock private CategoryRepository categoryRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private StoreOwnerRepository storeOwnerRepository;
    @Mock private StoreEmployeeRepository storeEmployeeRepository;
    @Mock private NotificationService notificationService;
    @Mock private StoreRepository storeRepository;
    @Mock private ActivityLogService activityLogService;

    @InjectMocks
    private CategoryService categoryService;

    @BeforeEach
    void setUp() {
        Store store = new Store();
        ReflectionTestUtils.setField(store, "id", STORE_ID);
        store.setName("Store " + STORE_ID);
        store.setActive(true);

        lenient().when(storeRepository.findAllById(List.of(STORE_ID))).thenReturn(List.of(store));
        lenient().when(categoryRepository.findByNameIgnoreCase(anyString())).thenReturn(List.of());
        lenient().when(storeEmployeeRepository.findDistinctByStoresIdInOrderByIdAscFetchEmployee(Set.of(STORE_ID)))
            .thenReturn(List.of());
        lenient().when(taskRepository.countByCategoryId(anyLong())).thenReturn(0);
        lenient().when(categoryRepository.findMaxDisplayOrder()).thenReturn(-1);
        lenient().when(categoryRepository.save(any(Category.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void createDefaultsToBlueAndLiveImmediately() {
        CategoryResponse response = categoryService.createCategoryAsSuperAdmin(
            new CategoryRequest("Opening", false, List.of(STORE_ID)));

        assertThat(response.badgeColor()).isEqualTo("blue");
        assertThat(response.startDate()).isNull();
        assertThat(response.active()).isTrue();
    }

    @Test
    void createWithEnableImmediatelyOffStartsTomorrowButStaysActive() {
        CategoryResponse response = categoryService.createCategoryAsSuperAdmin(
            new CategoryRequest("Opening", false, List.of(STORE_ID), "purple", false));

        assertThat(response.badgeColor()).isEqualTo("purple");
        assertThat(response.startDate()).isEqualTo(LocalDate.now().plusDays(1));
        // Stays active so tasks can still be added to it today.
        assertThat(response.active()).isTrue();
    }

    @Test
    void updateWithoutBadgeColorKeepsTheExistingOne() {
        Category existing = new Category();
        ReflectionTestUtils.setField(existing, "id", CATEGORY_ID);
        existing.setName("Opening");
        existing.setBadgeColor("green");
        existing.setStores(new HashSet<>());
        when(categoryRepository.findById(CATEGORY_ID)).thenReturn(Optional.of(existing));

        CategoryResponse response = categoryService.updateCategoryAsSuperAdmin(
            CATEGORY_ID, new CategoryRequest("Opening", false, List.of(STORE_ID)));

        assertThat(response.badgeColor()).isEqualTo("green");
    }
}
