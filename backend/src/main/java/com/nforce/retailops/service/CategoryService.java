package com.nforce.retailops.service;

import com.nforce.retailops.dto.CategoryRequest;
import com.nforce.retailops.dto.CategoryResponse;
import com.nforce.retailops.dto.StoreOptionResponse;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.exception.CategoryNameExistsException;
import com.nforce.retailops.exception.CategoryNotFoundException;
import com.nforce.retailops.exception.InvalidCategoryOrderException;
import com.nforce.retailops.exception.InvalidStoreSelectionException;
import com.nforce.retailops.exception.StoreInactiveException;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final TaskRepository taskRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;
    private final NotificationService notificationService;
    private final StoreRepository storeRepository;
    private final ActivityLogService activityLogService;

    public CategoryService(
        CategoryRepository categoryRepository,
        TaskRepository taskRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        NotificationService notificationService,
        StoreRepository storeRepository,
        ActivityLogService activityLogService
    ) {
        this.categoryRepository = categoryRepository;
        this.taskRepository = taskRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.notificationService = notificationService;
        this.storeRepository = storeRepository;
        this.activityLogService = activityLogService;
    }

    // ---------------------------------------------------------------------
    // Owner Admin -- read-only, except for reordering their configured
    // category order (the one write action Owner Admin has here; category
    // creation/editing/activation/deletion remain Super-Admin-only).
    // ---------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<CategoryResponse> listCategories(Long ownerId) {
        Set<Long> ownedStoreIds = ownerStoreIds(ownerId);
        List<Category> visible = categoryRepository.findVisibleToOwner(ownerId, sentinel(ownedStoreIds));
        return toResponses(visible, ownerId);
    }

    // Reorders the full set of categories visible to this owner (the same
    // set listCategories returns -- owner-created, store-assigned, and
    // "applies to all stores" Super-Admin categories alike), not just ones
    // this owner personally created.
    @Transactional
    public List<CategoryResponse> reorderCategories(Long ownerId, List<Long> orderedIds) {
        Set<Long> ownedStoreIds = ownerStoreIds(ownerId);
        List<Category> categories = categoryRepository.findVisibleToOwner(ownerId, sentinel(ownedStoreIds));
        Map<Long, Category> categoriesById = new LinkedHashMap<>();
        for (Category category : categories) {
            categoriesById.put(category.getId(), category);
        }

        boolean sameSize = orderedIds.size() == categoriesById.size();
        boolean noDuplicates = Set.copyOf(orderedIds).size() == orderedIds.size();
        if (!sameSize || !noDuplicates || !categoriesById.keySet().containsAll(orderedIds)) {
            throw new InvalidCategoryOrderException("orderedIds must include every category visible to you exactly once");
        }

        int order = 0;
        for (Long categoryId : orderedIds) {
            categoriesById.get(categoryId).setDisplayOrder(order++);
        }
        categoryRepository.saveAll(categoriesById.values());

        return listCategories(ownerId);
    }

    // ---------------------------------------------------------------------
    // Super Admin -- full management
    // ---------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<CategoryResponse> listCategoriesForSuperAdmin() {
        return toResponses(categoryRepository.findAllByOrderByNameAsc(), null);
    }

    @Transactional
    public CategoryResponse createCategoryAsSuperAdmin(CategoryRequest request) {
        String name = request.name().trim();
        Set<Store> resolvedStores = resolveAnyStores(request.appliesToAllStores(), request.storeIds());
        Set<Long> targetStoreIds = request.appliesToAllStores()
            ? allStoreIds()
            : resolvedStores.stream().map(Store::getId).collect(Collectors.toSet());

        if (namesOverlapInStores(name, null, targetStoreIds)) {
            throw new CategoryNameExistsException("A category with this name already exists for one of the selected stores");
        }

        Category category = new Category();
        category.setOwner(null);
        category.setName(name);
        category.setDisplayOrder(categoryRepository.findMaxDisplayOrder() + 1);
        category.setAppliesToAllStores(request.appliesToAllStores());
        category.setStores(resolvedStores);
        category = categoryRepository.save(category);

        notifyStores(category, targetStoreIds);
        activityLogService.logForStores(
            "CATEGORY_CREATED", "Super Admin", "SUPER_ADMIN",
            resolveStoresForLog(targetStoreIds), "CATEGORY", category.getName(),
            "Created category \"" + category.getName() + "\""
        );

        return toResponse(category);
    }

    @Transactional
    public CategoryResponse updateCategoryAsSuperAdmin(Long categoryId, CategoryRequest request) {
        Category category = categoryRepository.findById(categoryId)
            .orElseThrow(() -> new CategoryNotFoundException("Category not found"));

        String name = request.name().trim();
        Set<Store> resolvedStores = resolveAnyStores(request.appliesToAllStores(), request.storeIds());
        Set<Long> targetStoreIds = request.appliesToAllStores()
            ? allStoreIds()
            : resolvedStores.stream().map(Store::getId).collect(Collectors.toSet());

        if (namesOverlapInStores(name, categoryId, targetStoreIds)) {
            throw new CategoryNameExistsException("A category with this name already exists for one of the selected stores");
        }

        category.setName(name);
        category.setAppliesToAllStores(request.appliesToAllStores());
        category.setStores(resolvedStores);
        category = categoryRepository.save(category);

        activityLogService.logForStores(
            "CATEGORY_UPDATED", "Super Admin", "SUPER_ADMIN",
            resolveStoresForLog(targetStoreIds), "CATEGORY", category.getName(),
            "Updated category \"" + category.getName() + "\""
        );

        return toResponse(category);
    }

    @Transactional
    public CategoryResponse setActiveAsSuperAdmin(Long categoryId, boolean active) {
        Category category = categoryRepository.findById(categoryId)
            .orElseThrow(() -> new CategoryNotFoundException("Category not found"));

        category.setActive(active);
        category = categoryRepository.save(category);

        // Cascade: keep every task's own active flag in sync with its category's,
        // so Task Management's status column never shows "Active" for a task that's
        // actually hidden from the employee checklist because its category is off.
        List<Task> tasks = taskRepository.findByCategoryId(categoryId);
        tasks.forEach(task -> task.setActive(active));
        taskRepository.saveAll(tasks);

        activityLogService.logForStores(
            active ? "CATEGORY_ACTIVATED" : "CATEGORY_DEACTIVATED", "Super Admin", "SUPER_ADMIN",
            resolveStoresForLog(effectiveStoreIds(category)), "CATEGORY", category.getName(),
            (active ? "Activated category \"" : "Deactivated category \"") + category.getName() + "\""
        );

        return toResponse(category);
    }

    @Transactional
    public void deleteCategoryAsSuperAdmin(Long categoryId) {
        Category category = categoryRepository.findById(categoryId)
            .orElseThrow(() -> new CategoryNotFoundException("Category not found"));
        List<Store> affectedStores = resolveStoresForLog(effectiveStoreIds(category));
        String categoryName = category.getName();
        categoryRepository.delete(category);
        activityLogService.logForStores(
            "CATEGORY_DELETED", "Super Admin", "SUPER_ADMIN",
            affectedStores, "CATEGORY", categoryName,
            "Deleted category \"" + categoryName + "\""
        );
    }

    private List<Store> resolveStoresForLog(Set<Long> storeIds) {
        return storeIds.isEmpty() ? List.of() : storeRepository.findAllById(storeIds);
    }

    // ---------------------------------------------------------------------
    // Shared helpers
    // ---------------------------------------------------------------------

    private CategoryResponse toResponse(Category category) {
        List<StoreOptionResponse> stores = category.getStores().stream()
            .sorted(Comparator.comparing(Store::getName))
            .map(StoreOptionResponse::from)
            .toList();
        return CategoryResponse.from(category, taskRepository.countByCategoryId(category.getId()), stores);
    }

    // ownerId non-null: Owner Admin view -- task counts are scoped to that
    // owner's own tasks only, since a shared category's tasks can belong to
    // other owners entirely. ownerId null: Super Admin view -- global counts
    // across every owner, for a platform-wide picture of the category.
    private List<CategoryResponse> toResponses(List<Category> categories, Long ownerId) {
        if (categories.isEmpty()) {
            return List.of();
        }
        List<Long> ids = categories.stream().map(Category::getId).toList();

        List<Object[]> countRows = ownerId != null
            ? taskRepository.countGroupedByCategoryIdsForOwner(ids, ownerId)
            : taskRepository.countGroupedByCategoryIds(ids);
        Map<Long, Integer> taskCounts = countRows.stream()
            .collect(Collectors.toMap(row -> (Long) row[0], row -> ((Number) row[1]).intValue()));

        Map<Long, List<StoreOptionResponse>> storesByCategoryId = new LinkedHashMap<>();
        for (Object[] row : categoryRepository.findStoreRowsGroupedByCategoryIds(ids)) {
            storesByCategoryId.computeIfAbsent((Long) row[0], key -> new ArrayList<>())
                .add(new StoreOptionResponse((Long) row[1], (String) row[2]));
        }

        return categories.stream()
            .map(c -> CategoryResponse.from(
                c,
                taskCounts.getOrDefault(c.getId(), 0),
                storesByCategoryId.getOrDefault(c.getId(), List.of())))
            .toList();
    }

    private Set<Store> resolveAnyStores(boolean appliesToAllStores, List<Long> storeIds) {
        if (appliesToAllStores) {
            return new HashSet<>();
        }
        List<Long> ids = storeIds == null ? List.of() : storeIds;
        if (ids.isEmpty()) {
            throw new InvalidStoreSelectionException("Select at least one store, or choose All Stores");
        }
        List<Store> stores = storeRepository.findAllById(ids);
        if (stores.size() != Set.copyOf(ids).size()) {
            throw new InvalidStoreSelectionException("One or more selected stores could not be found");
        }
        if (stores.stream().anyMatch(s -> !s.isActive())) {
            throw new StoreInactiveException("One or more selected stores have been deactivated");
        }
        return new HashSet<>(stores);
    }

    private Set<Long> effectiveStoreIds(Category category) {
        if (category.isAppliesToAllStores()) {
            return category.getOwner() != null ? ownerStoreIds(category.getOwner().getId()) : allStoreIds();
        }
        return category.getStores().stream().map(Store::getId).collect(Collectors.toSet());
    }

    private Set<Long> allStoreIds() {
        return storeRepository.findAll().stream().map(Store::getId).collect(Collectors.toSet());
    }

    private Set<Long> ownerStoreIds(Long ownerId) {
        return storeOwnerRepository.findByOwnerId(ownerId).stream()
            .filter(StoreOwner::isActive)
            .map(so -> so.getStore().getId())
            .collect(Collectors.toSet());
    }

    private boolean namesOverlapInStores(String name, Long excludeCategoryId, Set<Long> targetStoreIds) {
        List<Category> sameName = excludeCategoryId == null
            ? categoryRepository.findByNameIgnoreCase(name)
            : categoryRepository.findByNameIgnoreCaseAndIdNot(name, excludeCategoryId);
        for (Category candidate : sameName) {
            if (!Collections.disjoint(effectiveStoreIds(candidate), targetStoreIds)) {
                return true;
            }
        }
        return false;
    }

    private void notifyStores(Category category, Set<Long> storeIds) {
        if (storeIds.isEmpty()) {
            return;
        }
        String categoryName = category.getName();
        storeEmployeeRepository.findDistinctByStoresIdInOrderByIdAscFetchEmployee(storeIds)
            .forEach(se -> notificationService.send(
                se.getEmployee(), "CATEGORY_ADDED",
                "New category: " + categoryName,
                "A new task category has been added to your store checklist.",
                "/checklist"));
    }

    private static List<Long> sentinel(Set<Long> ids) {
        return ids.isEmpty() ? List.of(-1L) : List.copyOf(ids);
    }
}
