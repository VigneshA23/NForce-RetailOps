package com.nforce.retailops.service;

import com.nforce.retailops.dto.CategoryRequest;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.CategoryNameExistsException;
import com.nforce.retailops.exception.CategoryNotFoundException;
import com.nforce.retailops.exception.InvalidStoreSelectionException;
import com.nforce.retailops.exception.StoreInactiveException;
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

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CategoryServiceStoreAssignmentTest {

    private static final Long OWNER_ID = 1L;
    private static final Long STORE_ID = 10L;
    private static final Long OTHER_STORE_ID = 20L;
    private static final Long CATEGORY_ID = 100L;

    @Mock private CategoryRepository categoryRepository;
    @Mock private TaskRepository taskRepository;
    @Mock private StoreOwnerRepository storeOwnerRepository;
    @Mock private StoreEmployeeRepository storeEmployeeRepository;
    @Mock private NotificationService notificationService;
    @Mock private StoreRepository storeRepository;

    @InjectMocks
    private CategoryService categoryService;

    private Store store(long id, boolean active) {
        Store store = new Store();
        ReflectionTestUtils.setField(store, "id", id);
        store.setName("Store " + id);
        store.setActive(active);
        return store;
    }

    private Category category(Long id, Long ownerId, boolean appliesToAllStores, Set<Store> stores) {
        Category category = new Category();
        ReflectionTestUtils.setField(category, "id", id);
        category.setName("Cleaning");
        category.setActive(true);
        if (ownerId != null) {
            User owner = new User();
            ReflectionTestUtils.setField(owner, "id", ownerId);
            category.setOwner(owner);
        }
        category.setAppliesToAllStores(appliesToAllStores);
        category.setStores(stores);
        return category;
    }

    @BeforeEach
    void setUp() {
        lenient().when(taskRepository.countByCategoryId(anyLong())).thenReturn(0);
        lenient().when(categoryRepository.save(any(Category.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void superAdminCannotAssignAStoreThatDoesNotExist() {
        when(storeRepository.findAllById(List.of(STORE_ID))).thenReturn(List.of());

        CategoryRequest request = new CategoryRequest("Opening", false, List.of(STORE_ID));

        assertThatThrownBy(() -> categoryService.createCategoryAsSuperAdmin(request))
            .isInstanceOf(InvalidStoreSelectionException.class);
    }

    @Test
    void superAdminCannotAssignADeactivatedStore() {
        Store inactiveStore = store(STORE_ID, false);
        when(storeRepository.findAllById(List.of(STORE_ID))).thenReturn(List.of(inactiveStore));

        CategoryRequest request = new CategoryRequest("Opening", false, List.of(STORE_ID));

        assertThatThrownBy(() -> categoryService.createCategoryAsSuperAdmin(request))
            .isInstanceOf(StoreInactiveException.class);
    }

    @Test
    void creatingACategoryWithTheSameNameInADifferentStoreIsAllowed() {
        Store storeA = store(STORE_ID, true);
        Store storeB = store(OTHER_STORE_ID, true);
        Category existingInStoreB = category(200L, null, false, Set.of(storeB));

        when(storeRepository.findAllById(List.of(STORE_ID))).thenReturn(List.of(storeA));
        when(categoryRepository.findByNameIgnoreCase("Cleaning")).thenReturn(List.of(existingInStoreB));
        when(storeEmployeeRepository.findDistinctByStoresIdInOrderByIdAscFetchEmployee(Set.of(STORE_ID)))
            .thenReturn(List.of());

        CategoryRequest request = new CategoryRequest("Cleaning", false, List.of(STORE_ID));

        categoryService.createCategoryAsSuperAdmin(request);
    }

    @Test
    void creatingACategoryWithTheSameNameInTheSameStoreIsRejected() {
        Store storeA = store(STORE_ID, true);
        Category existingInStoreA = category(200L, null, false, Set.of(storeA));

        when(storeRepository.findAllById(List.of(STORE_ID))).thenReturn(List.of(storeA));
        when(categoryRepository.findByNameIgnoreCase("Cleaning")).thenReturn(List.of(existingInStoreA));

        CategoryRequest request = new CategoryRequest("Cleaning", false, List.of(STORE_ID));

        assertThatThrownBy(() -> categoryService.createCategoryAsSuperAdmin(request))
            .isInstanceOf(CategoryNameExistsException.class);
    }

    @Test
    void anAllStoresCategoryOverlapsEveryStoreForUniquenessPurposes() {
        Category existingAllStores = category(200L, null, true, Set.of());
        Store storeA = store(STORE_ID, true);

        when(storeRepository.findAllById(List.of(STORE_ID))).thenReturn(List.of(storeA));
        when(categoryRepository.findByNameIgnoreCase("Cleaning")).thenReturn(List.of(existingAllStores));
        when(storeRepository.findAll()).thenReturn(List.of(storeA));

        CategoryRequest request = new CategoryRequest("Cleaning", false, List.of(STORE_ID));

        assertThatThrownBy(() -> categoryService.createCategoryAsSuperAdmin(request))
            .isInstanceOf(CategoryNameExistsException.class);
    }

    @Test
    void ownerAdminSeesAStoreSpecificCategoryAssignedToTheirStore() {
        Store ownedStore = store(STORE_ID, true);
        StoreOwner link = new StoreOwner();
        link.setStore(ownedStore);
        link.setActive(true);
        Category visibleCategory = category(CATEGORY_ID, null, false, Set.of(ownedStore));

        when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(link));
        when(categoryRepository.findVisibleToOwner(OWNER_ID, List.of(STORE_ID))).thenReturn(List.of(visibleCategory));
        when(taskRepository.countGroupedByCategoryIds(List.of(CATEGORY_ID))).thenReturn(List.of());
        when(categoryRepository.findStoreRowsGroupedByCategoryIds(List.of(CATEGORY_ID))).thenReturn(List.of());

        var result = categoryService.listCategories(OWNER_ID);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo(CATEGORY_ID);
    }

    @Test
    void updatingAMissingCategoryAsSuperAdminThrowsNotFound() {
        when(categoryRepository.findById(CATEGORY_ID)).thenReturn(Optional.empty());

        CategoryRequest request = new CategoryRequest("Cleaning", true, List.of());

        assertThatThrownBy(() -> categoryService.updateCategoryAsSuperAdmin(CATEGORY_ID, request))
            .isInstanceOf(CategoryNotFoundException.class);
    }
}
