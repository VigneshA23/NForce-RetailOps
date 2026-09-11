# Category Store Assignment & Super Admin Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Super Admin create/edit/activate-deactivate checklist categories with store assignment (All Stores or specific stores), see all categories and their store assignments platform-wide, and give Owner Admin a **read-only** view of whichever categories apply to their own store(s) — no create/edit/delete/status-toggle access for Owner Admin.

**Architecture:** `Category` moves from a strict single-owner model to a store-scoped model identical in shape to the existing `Task`/`task_stores` pattern (`applies_to_all_stores` boolean + a `category_stores` join table), with `owner_id` becoming nullable (retained only as historical/audit info for categories created before this change; every category created from now on is Super-Admin-authored, `owner_id IS NULL`). Category management (create/edit/status/delete) becomes exclusively a Super Admin capability; Owner Admin keeps only `GET`.

**Tech Stack:** Spring Boot 3 / Java 17 / Spring Data JPA / PostgreSQL (Neon) + Flyway; React 18 / TypeScript / Vite frontend with plain-fetch API layer.

**Spec:** `docs/superpowers/specs/2026-09-11-category-store-assignment-design.md` (superseded on one point by later direction from the user: Owner Admin access is view-only, not "same capability as Super Admin" as the spec originally said — this plan implements the corrected, view-only version throughout).

## Global Constraints

- **Category management (create, edit name/store-assignment/all-stores flag, activate/deactivate, delete) is Super-Admin-only.** Owner Admin has read-only access: `GET /api/categories` only.
- **Visibility** (what an Owner Admin's `GET /api/categories` returns): a category if it has a store they own, OR it's marked "all stores" and (historically) they created it, OR it's marked "all stores" and Super Admin created it (`owner_id IS NULL`). Super Admin's `GET` returns every category, platform-wide, unfiltered.
- **`owner_id` becomes purely historical.** Categories created before this change keep their `owner_id` (their original creator) — this only affects how their "all stores" flag is interpreted (relative to that owner's stores) and is shown to Super Admin as attribution. Every category created after this change is created by Super Admin, `owner_id IS NULL`, "all stores" meaning literally every platform store.
- **Name uniqueness is per-store**: a new/edited category's name may not collide (case-insensitive) with any existing category whose *effective* store set overlaps its own. "Effective store set" expands `appliesToAllStores` against real stores (a legacy owner-created category's own stores if `owner_id` is set, every platform store if `owner_id IS NULL`).
- **`PATCH /api/categories/reorder` is left completely untouched** — pre-existing, Owner-Admin-only, scoped strictly to categories that owner personally created (`findByOwnerIdOrderByDisplayOrderAsc`), and already has no frontend caller today (confirmed: nothing in `frontend/src/` calls `reorderCategories` from `api/categories.ts`). It's orthogonal to this feature and out of scope — not surfaced in the (now read-only) Owner Admin Categories UI, but the backend endpoint/method is not modified or removed.
- Reuses existing exceptions only — no new exception classes: `CategoryNotFoundException` (404), `CategoryNameExistsException` (409), `InvalidStoreSelectionException` (400), `StoreInactiveException` (409). All four are already mapped in `GlobalExceptionHandler`.
- Super Admin authenticates as a distinct principal type (`SuperAdminUserDetails`, not `AppUserDetails`) — `@AuthenticationPrincipal AppUserDetails` binds to `null` for a Super Admin request. Since every mutating endpoint is now `@PreAuthorize("hasRole('SUPER_ADMIN')")`-only, those methods don't need an `AppUserDetails`/`Authentication` parameter at all. Only `GET` is shared between roles and must branch on `Authentication.getPrincipal() instanceof AppUserDetails`, following `ChecklistHistoryController`'s existing pattern.

---

## Task 1: Migration + `Category` entity

**Files:**
- Create: `backend/src/main/resources/db/migration/V51__category_store_assignment.sql`
- Modify: `backend/src/main/java/com/nforce/retailops/entity/Category.java`

**Interfaces:**
- Produces: `Category.isAppliesToAllStores()/setAppliesToAllStores(boolean)`, `Category.getStores()/setStores(Set<Store>)`, and `Category.getOwner()` now legitimately returns `null`.

- [ ] **Step 1: Write the migration**

```sql
alter table categories alter column owner_id drop not null;
alter table categories add column applies_to_all_stores boolean not null default false;

update categories set applies_to_all_stores = true;

create table category_stores (
    category_id bigint not null,
    store_id bigint not null,
    primary key (category_id, store_id)
);
alter table category_stores add constraint fk_category_stores_category
    foreign key (category_id) references categories on delete cascade;
alter table category_stores add constraint fk_category_stores_store
    foreign key (store_id) references stores;
```

- [ ] **Step 2: Update the `Category` entity**

Add these fields/accessors to `backend/src/main/java/com/nforce/retailops/entity/Category.java` (add `import java.util.HashSet; import java.util.Set;` alongside the existing imports):

```java
    @Column(name = "applies_to_all_stores", nullable = false)
    private boolean appliesToAllStores;

    @ManyToMany
    @JoinTable(
        name = "category_stores",
        joinColumns = @JoinColumn(name = "category_id"),
        inverseJoinColumns = @JoinColumn(name = "store_id")
    )
    private Set<Store> stores = new HashSet<>();
```

with getters/setters:

```java
    public boolean isAppliesToAllStores() {
        return appliesToAllStores;
    }

    public void setAppliesToAllStores(boolean appliesToAllStores) {
        this.appliesToAllStores = appliesToAllStores;
    }

    public Set<Store> getStores() {
        return stores;
    }

    public void setStores(Set<Store> stores) {
        this.stores = stores;
    }
```

- [ ] **Step 3: Compile-check**

Run: `cd backend && mvn compile`
Expected: SUCCESS (this entity change alone doesn't break any existing caller — nothing reads the new fields yet).

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/migration/V51__category_store_assignment.sql backend/src/main/java/com/nforce/retailops/entity/Category.java
git commit -m "Add store assignment columns to Category entity"
```

---

## Task 2: `CategoryRepository` queries

**Files:**
- Modify: `backend/src/main/java/com/nforce/retailops/repository/CategoryRepository.java`

**Interfaces:**
- Consumes: `Category` (Task 1).
- Produces: `findVisibleToOwner(Long ownerId, List<Long> storeIds)`, `findStoreRowsGroupedByCategoryIds(Collection<Long> categoryIds)`, `findAllByOrderByNameAsc()`, `findByNameIgnoreCase(String)`, `findByNameIgnoreCaseAndIdNot(String, Long)` — all consumed by `CategoryService` in Task 4. Keeps `findByOwnerIdOrderByDisplayOrderAsc` (used unchanged by the untouched `reorderCategories`).

- [ ] **Step 1: Replace the file's query methods**

Replace `backend/src/main/java/com/nforce/retailops/repository/CategoryRepository.java` in full with:

```java
package com.nforce.retailops.repository;

import com.nforce.retailops.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    // Used only by the pre-existing, untouched reorderCategories (Owner-Admin-
    // only, scoped to categories that owner personally created).
    List<Category> findByOwnerIdOrderByDisplayOrderAsc(Long ownerId);

    List<Category> findAllByOrderByNameAsc();

    List<Category> findByNameIgnoreCase(String name);

    List<Category> findByNameIgnoreCaseAndIdNot(String name, Long id);

    // Visible to an Owner Admin (read-only): has a store they own, OR is "all
    // stores" and they historically created it themselves, OR is "all stores"
    // and Super Admin created it (owner IS NULL).
    @Query("""
        select distinct c from Category c
        left join c.stores s
        where s.id in (:storeIds)
           or (c.appliesToAllStores = true and c.owner.id = :ownerId)
           or (c.appliesToAllStores = true and c.owner is null)
        order by c.name asc
        """)
    List<Category> findVisibleToOwner(@Param("ownerId") Long ownerId, @Param("storeIds") List<Long> storeIds);

    // Batched form for listing many categories at once without one query per
    // category -- mirrors TaskRepository.findStoreRowsGroupedByTaskIds.
    @Query("select c.id, s.id, s.name from Category c join c.stores s where c.id in :categoryIds order by s.name asc")
    List<Object[]> findStoreRowsGroupedByCategoryIds(@Param("categoryIds") Collection<Long> categoryIds);
}
```

Note what was intentionally dropped versus today: `findOwnerCategorySummaryRows`, `findByIdAndOwnerId`, `existsByOwnerIdAndNameIgnoreCase(AndIdNot)`, `countByOwnerId`, `searchByOwnerIdAndName` (that last one moves to `AdminSearchService` in Task 2b below — it's Owner-Admin quick-search, unrelated to category CRUD, and needs to keep working).

- [ ] **Step 2: Check `AdminSearchService`'s use of `searchByOwnerIdAndName`**

`backend/src/main/java/com/nforce/retailops/service/AdminSearchService.java` calls `categoryRepository.searchByOwnerIdAndName(ownerId, trimmed, top5)` for the owner's quick-search. Since Owner Admin quick-search is an existing, separate feature (searching *the categories they created*, unrelated to this change), keep it working exactly as before by adding this method back into `CategoryRepository.java` alongside the others (it was dropped by the full-file replacement in Step 1 — add it back in):

```java
import org.springframework.data.domain.Pageable;
```

```java
    @Query("select c from Category c where c.owner.id = :ownerId "
        + "and lower(c.name) like lower(concat('%', :q, '%')) order by c.name")
    List<Category> searchByOwnerIdAndName(@Param("ownerId") Long ownerId, @Param("q") String q, Pageable pageable);
```

- [ ] **Step 3: Compile-check**

Run: `cd backend && mvn compile`
Expected: FAILS — `CategoryService` still references the dropped methods (`findByIdAndOwnerId`, `countByOwnerId`, etc.). This is expected; Task 4 fixes it. Confirm the only compile errors are inside `CategoryService.java`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/nforce/retailops/repository/CategoryRepository.java
git commit -m "Replace CategoryRepository's owner-only queries with store-visibility queries"
```

---

## Task 3: DTOs

**Files:**
- Modify: `backend/src/main/java/com/nforce/retailops/dto/CategoryRequest.java`
- Modify: `backend/src/main/java/com/nforce/retailops/dto/CategoryResponse.java`

**Interfaces:**
- Consumes: `Category`, `Store` (Task 1), `StoreOptionResponse` (existing, `backend/src/main/java/com/nforce/retailops/dto/StoreOptionResponse.java` — `record StoreOptionResponse(Long id, String name)` with `static StoreOptionResponse from(Store store)`).
- Produces: `CategoryRequest(String name, boolean appliesToAllStores, List<Long> storeIds)`, `CategoryResponse.from(Category, int taskCount, List<StoreOptionResponse> stores)` — consumed by `CategoryService`/`CategoryController` in Tasks 4/6.

- [ ] **Step 1: Update `CategoryRequest`**

Replace `backend/src/main/java/com/nforce/retailops/dto/CategoryRequest.java` in full:

```java
package com.nforce.retailops.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CategoryRequest(
    @NotBlank(message = "Name is required")
    @Size(max = 100, message = "Name must be 100 characters or fewer")
    String name,

    boolean appliesToAllStores,

    List<Long> storeIds
) {
}
```

- [ ] **Step 2: Update `CategoryResponse`**

Replace `backend/src/main/java/com/nforce/retailops/dto/CategoryResponse.java` in full:

```java
package com.nforce.retailops.dto;

import com.nforce.retailops.entity.Category;

import java.util.Comparator;
import java.util.List;

public record CategoryResponse(
    Long id,
    String name,
    int displayOrder,
    boolean active,
    int taskCount,
    boolean appliesToAllStores,
    List<StoreOptionResponse> stores,
    Long createdByOwnerId,
    String createdByOwnerName
) {
    public static CategoryResponse from(Category category, int taskCount, List<StoreOptionResponse> stores) {
        List<StoreOptionResponse> sortedStores = stores.stream()
            .sorted(Comparator.comparing(StoreOptionResponse::name))
            .toList();

        Long ownerId = category.getOwner() != null ? category.getOwner().getId() : null;
        String ownerName = category.getOwner() != null ? category.getOwner().getFullName() : "Super Admin";

        return new CategoryResponse(
            category.getId(),
            category.getName(),
            category.getDisplayOrder(),
            category.isActive(),
            taskCount,
            category.isAppliesToAllStores(),
            sortedStores,
            ownerId,
            ownerName
        );
    }
}
```

- [ ] **Step 3: Compile-check**

Run: `cd backend && mvn compile`
Expected: still FAILS inside `CategoryService.java` (unchanged from Task 2's expected failure) — confirm no new/different compile errors from the DTO changes themselves.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/nforce/retailops/dto/CategoryRequest.java backend/src/main/java/com/nforce/retailops/dto/CategoryResponse.java
git commit -m "Extend Category DTOs with store assignment fields"
```

---

## Task 4: `CategoryService` rewrite

**Files:**
- Modify: `backend/src/main/java/com/nforce/retailops/service/CategoryService.java`
- Modify: `backend/src/test/java/com/nforce/retailops/service/CategoryServiceActiveCascadeTest.java`

**Interfaces:**
- Consumes: `CategoryRepository` (Task 2), `CategoryRequest`/`CategoryResponse` (Task 3), existing `StoreRepository` (`storeRepository.findAll()`, `storeRepository.findAllById(Iterable<Long>)` — both inherited from `JpaRepository`), existing `StoreOwnerRepository.findByOwnerId(Long)`, existing `TaskRepository.countGroupedByCategoryIds(Collection<Long>)` / `countByCategoryId(Long)` / `findByCategoryId(Long)`, existing `StoreEmployeeRepository.findDistinctByStoresIdInOrderByIdAscFetchEmployee(Collection<Long>)`.
- Produces (new public methods, consumed by `CategoryController` in Task 6): `listCategoriesForSuperAdmin()`, `createCategoryAsSuperAdmin(CategoryRequest)`, `updateCategoryAsSuperAdmin(Long, CategoryRequest)`, `setActiveAsSuperAdmin(Long, boolean)`, `deleteCategoryAsSuperAdmin(Long)`. Keeps existing `listCategories(Long)` (now read-only-visibility-scoped) and `reorderCategories(Long, List<Long>)` (untouched). **Removes** the old owner-facing `createCategory`, `updateCategory`, `setActive`, `deleteCategory` — category mutation is Super-Admin-only now.

- [ ] **Step 1: Replace the whole file**

Replace `backend/src/main/java/com/nforce/retailops/service/CategoryService.java` in full:

```java
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

    public CategoryService(
        CategoryRepository categoryRepository,
        TaskRepository taskRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        NotificationService notificationService,
        StoreRepository storeRepository
    ) {
        this.categoryRepository = categoryRepository;
        this.taskRepository = taskRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.notificationService = notificationService;
        this.storeRepository = storeRepository;
    }

    // ---------------------------------------------------------------------
    // Owner Admin -- read-only
    // ---------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<CategoryResponse> listCategories(Long ownerId) {
        Set<Long> ownedStoreIds = ownerStoreIds(ownerId);
        List<Category> visible = categoryRepository.findVisibleToOwner(ownerId, sentinel(ownedStoreIds));
        return toResponses(visible);
    }

    // Pre-existing feature, unaffected by category management moving to
    // Super-Admin-only: still scoped strictly to categories this owner
    // created themselves, unchanged from before this feature (see Global
    // Constraints -- no frontend caller today, left as-is).
    @Transactional
    public List<CategoryResponse> reorderCategories(Long ownerId, List<Long> orderedIds) {
        List<Category> categories = categoryRepository.findByOwnerIdOrderByDisplayOrderAsc(ownerId);
        Map<Long, Category> categoriesById = new LinkedHashMap<>();
        for (Category category : categories) {
            categoriesById.put(category.getId(), category);
        }

        boolean sameSize = orderedIds.size() == categoriesById.size();
        boolean noDuplicates = Set.copyOf(orderedIds).size() == orderedIds.size();
        if (!sameSize || !noDuplicates || !categoriesById.keySet().containsAll(orderedIds)) {
            throw new InvalidCategoryOrderException("orderedIds must include every one of your categories exactly once");
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
        return toResponses(categoryRepository.findAllByOrderByNameAsc());
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
        category.setDisplayOrder(0);
        category.setAppliesToAllStores(request.appliesToAllStores());
        category.setStores(resolvedStores);
        category = categoryRepository.save(category);

        notifyStores(category, targetStoreIds);

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

        return toResponse(category);
    }

    @Transactional
    public void deleteCategoryAsSuperAdmin(Long categoryId) {
        Category category = categoryRepository.findById(categoryId)
            .orElseThrow(() -> new CategoryNotFoundException("Category not found"));
        categoryRepository.delete(category);
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

    private List<CategoryResponse> toResponses(List<Category> categories) {
        if (categories.isEmpty()) {
            return List.of();
        }
        List<Long> ids = categories.stream().map(Category::getId).toList();

        Map<Long, Integer> taskCounts = taskRepository.countGroupedByCategoryIds(ids).stream()
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
```

- [ ] **Step 2: Update `CategoryServiceActiveCascadeTest`**

`setActive(ownerId, id, active)` no longer exists — status toggling is now `setActiveAsSuperAdmin(id, active)`, looked up via plain `findById`, no owner. Replace `backend/src/test/java/com/nforce/retailops/service/CategoryServiceActiveCascadeTest.java` in full:

```java
package com.nforce.retailops.service;

import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.TaskRepository;
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

    private static final Long CATEGORY_ID = 5L;

    @Mock
    private CategoryRepository categoryRepository;
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
        when(categoryRepository.findById(CATEGORY_ID)).thenReturn(Optional.of(category));
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

        categoryService.setActiveAsSuperAdmin(CATEGORY_ID, false);

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

        categoryService.setActiveAsSuperAdmin(CATEGORY_ID, true);

        assertThat(category.isActive()).isTrue();
        assertThat(inactiveTask.isActive()).isTrue();
        verify(taskRepository).saveAll(anyList());
    }
}
```

- [ ] **Step 3: Run it**

Run: `cd backend && mvn test -Dtest=CategoryServiceActiveCascadeTest`
Expected: both tests PASS.

- [ ] **Step 4: Check `CategoryServiceReorderTest` still compiles and passes as-is**

`reorderCategories`'s implementation and signature are unchanged, and its test (`backend/src/test/java/com/nforce/retailops/service/CategoryServiceReorderTest.java`) mocks `categoryRepository.findByOwnerIdOrderByDisplayOrderAsc` and `categoryRepository.findOwnerCategorySummaryRows` — but `findOwnerCategorySummaryRows` was dropped from `CategoryRepository` in Task 2, and `listCategories` (called at the end of `reorderCategories`) now calls `findVisibleToOwner`/`storeOwnerRepository.findByOwnerId` instead. Update its mocks: replace every `when(categoryRepository.findOwnerCategorySummaryRows(OWNER_ID)).thenReturn(List.of());` line with nothing (delete those lines), add a `@Mock private StoreOwnerRepository storeOwnerRepository;` field (add `import com.nforce.retailops.repository.StoreOwnerRepository;`), and add to `@BeforeEach setUp()`:

```java
        lenient().when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of());
        lenient().when(categoryRepository.findVisibleToOwner(eq(OWNER_ID), anyList())).thenReturn(List.of());
```

Add `import static org.mockito.ArgumentMatchers.eq;` and `import static org.mockito.ArgumentMatchers.anyList;` to its existing static imports (it already imports `lenient` via `import static org.mockito.Mockito.*;`).

- [ ] **Step 5: Run it**

Run: `cd backend && mvn test -Dtest=CategoryServiceReorderTest`
Expected: all 4 tests PASS.

- [ ] **Step 6: Compile the full backend**

Run: `cd backend && mvn compile`
Expected: FAILS only inside `CategoryController.java` (Task 6 fixes it) — confirm no other module references the removed `CategoryService` methods.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/nforce/retailops/service/CategoryService.java backend/src/test/java/com/nforce/retailops/service/CategoryServiceActiveCascadeTest.java backend/src/test/java/com/nforce/retailops/service/CategoryServiceReorderTest.java
git commit -m "Make category create/edit/status/delete Super-Admin-only; owner keeps read-only visibility"
```

---

## Task 5: New `CategoryService` tests for store assignment and uniqueness

**Files:**
- Create: `backend/src/test/java/com/nforce/retailops/service/CategoryServiceStoreAssignmentTest.java`

**Interfaces:**
- Consumes: `CategoryService` (Task 4), `CategoryRequest` (Task 3), `Category`/`Store`/`StoreOwner`/`User` entities, `CategoryRepository`/`TaskRepository`/`StoreOwnerRepository`/`StoreEmployeeRepository`/`NotificationService`/`StoreRepository` mocks.

- [ ] **Step 1: Write the test file**

```java
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
```

- [ ] **Step 2: Run the new test**

Run: `cd backend && mvn test -Dtest=CategoryServiceStoreAssignmentTest`
Expected: all 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/test/java/com/nforce/retailops/service/CategoryServiceStoreAssignmentTest.java
git commit -m "Add tests for Super Admin category store assignment and per-store name uniqueness"
```

---

## Task 6: `CategoryController`

**Files:**
- Modify: `backend/src/main/java/com/nforce/retailops/controller/CategoryController.java`
- Create: `backend/src/test/java/com/nforce/retailops/controller/CategoryControllerRoleAccessTest.java`

**Interfaces:**
- Consumes: `CategoryService` (Task 4), `CategoryRequest`/`CategoryResponse`/`CategoryStatusRequest`/`CategoryReorderRequest` (Task 3 + existing), `AppUserDetails` (existing, `backend/src/main/java/com/nforce/retailops/security/AppUserDetails.java`).

- [ ] **Step 1: Replace the controller**

Replace `backend/src/main/java/com/nforce/retailops/controller/CategoryController.java` in full:

```java
package com.nforce.retailops.controller;

import com.nforce.retailops.dto.CategoryReorderRequest;
import com.nforce.retailops.dto.CategoryRequest;
import com.nforce.retailops.dto.CategoryResponse;
import com.nforce.retailops.dto.CategoryStatusRequest;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.CategoryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
@PreAuthorize("hasAnyRole('OWNER_ADMIN', 'SUPER_ADMIN')")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    // Shared by both roles: Owner Admin gets their store-scoped read-only
    // view, Super Admin gets every category platform-wide.
    @GetMapping
    public ResponseEntity<List<CategoryResponse>> list(Authentication authentication) {
        if (authentication.getPrincipal() instanceof AppUserDetails appUserDetails) {
            return ResponseEntity.ok(categoryService.listCategories(appUserDetails.getUser().getId()));
        }
        return ResponseEntity.ok(categoryService.listCategoriesForSuperAdmin());
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<CategoryResponse> create(@Valid @RequestBody CategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(categoryService.createCategoryAsSuperAdmin(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<CategoryResponse> update(
        @PathVariable Long id,
        @Valid @RequestBody CategoryRequest request
    ) {
        return ResponseEntity.ok(categoryService.updateCategoryAsSuperAdmin(id, request));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<CategoryResponse> updateStatus(
        @PathVariable Long id,
        @Valid @RequestBody CategoryStatusRequest request
    ) {
        return ResponseEntity.ok(categoryService.setActiveAsSuperAdmin(id, request.active()));
    }

    // Pre-existing, Owner-Admin-only, untouched by this feature -- see Global
    // Constraints. No frontend caller today.
    @PatchMapping("/reorder")
    @PreAuthorize("hasRole('OWNER_ADMIN')")
    public ResponseEntity<List<CategoryResponse>> reorder(
        @AuthenticationPrincipal AppUserDetails principal,
        @Valid @RequestBody CategoryReorderRequest request
    ) {
        return ResponseEntity.ok(categoryService.reorderCategories(principal.getUser().getId(), request.orderedIds()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        categoryService.deleteCategoryAsSuperAdmin(id);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 2: Compile the backend fully**

Run: `cd backend && mvn compile`
Expected: SUCCESS.

- [ ] **Step 3: Write a role-access MockMvc test**

Read `backend/src/test/java/com/nforce/retailops/controller/ChecklistHistoryControllerTest.java` first to copy its exact MockMvc + Spring Security test setup (mock user/super-admin principal construction, `@AutoConfigureMockMvc`/`@SpringBootTest` annotations, JSON assertion style, fixture helpers for a persisted owner/store/super-admin in the H2 test DB). Then create `backend/src/test/java/com/nforce/retailops/controller/CategoryControllerRoleAccessTest.java` following that exact pattern, covering:
- A plain `EMPLOYEE` gets 403 on `GET /api/categories`.
- An `OWNER_ADMIN` gets 200 on `GET /api/categories`.
- A `SUPER_ADMIN` gets 200 on `GET /api/categories` (this is the case that would NPE if the controller ever bound `@AuthenticationPrincipal AppUserDetails` on this path instead of `Authentication`).
- An `OWNER_ADMIN` gets 403 on `POST /api/categories`.
- An `OWNER_ADMIN` gets 403 on `DELETE /api/categories/{id}`.
- A `SUPER_ADMIN` gets 201 on `POST /api/categories` with a valid body (e.g. `{"name":"Opening","appliesToAllStores":true,"storeIds":[]}`).

- [ ] **Step 4: Run it**

Run: `cd backend && mvn test -Dtest=CategoryControllerRoleAccessTest`
Expected: all assertions PASS.

- [ ] **Step 5: Run the full backend test suite**

Run: `cd backend && mvn test`
Expected: all tests PASS (this is the checkpoint that the whole backend change is coherent).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/nforce/retailops/controller/CategoryController.java backend/src/test/java/com/nforce/retailops/controller/CategoryControllerRoleAccessTest.java
git commit -m "Restrict category create/edit/status/delete endpoints to Super Admin"
```

---

## Task 7: Frontend types & API layer

**Files:**
- Modify: `frontend/src/types/category.ts`
- Modify: `frontend/src/api/categories.ts`

**Interfaces:**
- Produces: `Category` (extended), `CategoryFormValues` (extended), `getCategories()`, `createCategory(values)`, `updateCategory(id, values)`, `updateCategoryStatus(id, active)`, `reorderCategories(orderedIds)`, `deleteCategory(id)` — consumed by every frontend task after this one. (`createCategory`/`updateCategory`/`updateCategoryStatus`/`deleteCategory` are now called only from the Super Admin page, Task 9 — Owner Admin's page only calls `getCategories`.)

- [ ] **Step 1: Update the type**

Replace `frontend/src/types/category.ts` in full:

```ts
export interface CategoryStoreOption {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  name: string;
  displayOrder: number;
  active: boolean;
  taskCount: number;
  appliesToAllStores: boolean;
  stores: CategoryStoreOption[];
  createdByOwnerId: number | null;
  createdByOwnerName: string;
}

export type CategoryFormValues = {
  name: string;
  appliesToAllStores: boolean;
  storeIds: number[];
};
```

- [ ] **Step 2: Confirm the API layer needs no functional changes**

`frontend/src/api/categories.ts`'s existing `createCategory`/`updateCategory` already forward `JSON.stringify(values)` verbatim, so once `CategoryFormValues` (Step 1) carries `appliesToAllStores`/`storeIds`, no code change is needed in this file. Leave it as-is.

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: FAILS — `CategoryFormModal.tsx`/`Categories.tsx` still use the old shapes. This is expected; Tasks 8-9 fix it.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/category.ts
git commit -m "Extend Category type with store assignment fields"
```

---

## Task 8: `CategoryStorePicker` component (Super Admin's store picker)

**Files:**
- Create: `frontend/src/components/CategoryStorePicker.tsx`
- Create: `frontend/src/components/CategoryStorePicker.css`
- Create: `frontend/src/components/CategoryStorePicker.test.tsx`

**Interfaces:**
- Consumes: `CategoryStoreOption` (Task 7).
- Produces: `<CategoryStorePicker stores={CategoryStoreOption[]} value={{appliesToAllStores, storeIds}} onChange={(next) => void} />` — consumed by `CategoryFormModal` in Task 9 (Super Admin's create/edit form).

- [ ] **Step 1: Write the component**

```tsx
import type { CategoryStoreOption } from '../types/category';
import './CategoryStorePicker.css';

interface CategoryStorePickerValue {
  appliesToAllStores: boolean;
  storeIds: number[];
}

interface CategoryStorePickerProps {
  stores: CategoryStoreOption[];
  value: CategoryStorePickerValue;
  onChange: (next: CategoryStorePickerValue) => void;
}

function CategoryStorePicker({ stores, value, onChange }: CategoryStorePickerProps) {
  function handleAllStoresToggle(checked: boolean) {
    onChange({ appliesToAllStores: checked, storeIds: checked ? [] : value.storeIds });
  }

  function handleStoreToggle(storeId: number, checked: boolean) {
    const next = checked
      ? [...value.storeIds, storeId]
      : value.storeIds.filter((id) => id !== storeId);
    onChange({ appliesToAllStores: false, storeIds: next });
  }

  return (
    <div className="category-store-picker">
      <label className="category-store-picker__option category-store-picker__option--all">
        <input
          type="checkbox"
          checked={value.appliesToAllStores}
          onChange={(event) => handleAllStoresToggle(event.target.checked)}
        />
        All Stores
      </label>
      {!value.appliesToAllStores && (
        <div className="category-store-picker__list">
          {stores.map((store) => (
            <label key={store.id} className="category-store-picker__option">
              <input
                type="checkbox"
                checked={value.storeIds.includes(store.id)}
                onChange={(event) => handleStoreToggle(store.id, event.target.checked)}
              />
              {store.name}
            </label>
          ))}
          {stores.length === 0 && (
            <p className="category-store-picker__empty">No stores available to select.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default CategoryStorePicker;
```

- [ ] **Step 2: Write the stylesheet**

```css
.category-store-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.category-store-picker__option {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 0.875rem;
  color: var(--color-text-primary);
}

.category-store-picker__option--all {
  font-weight: 600;
}

.category-store-picker__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs, 4px);
  padding-left: var(--space-sm);
  max-height: 220px;
  overflow-y: auto;
}

.category-store-picker__empty {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}
```

- [ ] **Step 3: Add a component test**

Read `frontend/src/components/Header.test.tsx` first to copy its exact Vitest + Testing Library render/setup pattern. Then create `frontend/src/components/CategoryStorePicker.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryStorePicker from './CategoryStorePicker';

const STORES = [
  { id: 1, name: 'Downtown' },
  { id: 2, name: 'Uptown' },
];

describe('CategoryStorePicker', () => {
  it('hides the store list and clears storeIds when All Stores is checked', () => {
    const onChange = vi.fn();
    render(
      <CategoryStorePicker
        stores={STORES}
        value={{ appliesToAllStores: false, storeIds: [1] }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('All Stores'));

    expect(onChange).toHaveBeenCalledWith({ appliesToAllStores: true, storeIds: [] });
  });

  it('adds a store id when its checkbox is checked', () => {
    const onChange = vi.fn();
    render(
      <CategoryStorePicker
        stores={STORES}
        value={{ appliesToAllStores: false, storeIds: [1] }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByLabelText('Uptown'));

    expect(onChange).toHaveBeenCalledWith({ appliesToAllStores: false, storeIds: [1, 2] });
  });
});
```

- [ ] **Step 4: Run it**

Run: `cd frontend && npx vitest run src/components/CategoryStorePicker.test.tsx`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CategoryStorePicker.tsx frontend/src/components/CategoryStorePicker.css frontend/src/components/CategoryStorePicker.test.tsx
git commit -m "Add CategoryStorePicker component for Super Admin category management"
```

---

## Task 9: `CategoryTable` becomes role-aware; `CategoryFormModal` gains store assignment

**Files:**
- Modify: `frontend/src/components/CategoryTable.tsx`
- Modify: `frontend/src/components/CategoryTable.css`
- Modify: `frontend/src/components/CategoryFormModal.tsx`

**Interfaces:**
- Consumes: `CategoryStorePicker` (Task 8), `Category`/`CategoryFormValues`/`CategoryStoreOption` (Task 7).
- Produces: `<CategoryTable categories canManage isLoading onEdit? onDelete? onToggleStatus? />` (edit/delete/status callbacks only required when `canManage` is true), `<CategoryFormModal ... availableStores />` — consumed by `Categories.tsx` (Task 10, read-only) and `SuperAdminCategories.tsx` (Task 11, full control).

- [ ] **Step 1: Replace `CategoryTable`**

Replace `frontend/src/components/CategoryTable.tsx` in full:

```tsx
import { Pencil, Trash2 } from 'lucide-react';
import type { Category } from '../types/category';
import Toggle from './Toggle';
import './CategoryTable.css';

interface CategoryTableProps {
  categories: Category[];
  canManage: boolean;
  isLoading?: boolean;
  onEdit?: (category: Category) => void;
  onDelete?: (category: Category) => void;
  onToggleStatus?: (category: Category, active: boolean) => void;
}

function storesLabel(category: Category): string {
  if (category.appliesToAllStores) return 'All Stores';
  if (category.stores.length === 0) return '—';
  return category.stores.map((store) => store.name).join(', ');
}

function CategoryTable({
  categories,
  canManage,
  isLoading = false,
  onEdit,
  onDelete,
  onToggleStatus,
}: CategoryTableProps) {
  return (
    <div className="category-table__card table-card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Category Name</th>
              <th scope="col">Stores</th>
              <th scope="col">Tasks</th>
              <th scope="col">Status</th>
              {canManage && <th scope="col" className="task-table__actions-header">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="category-table__row">
                <td className="category-table__name" data-label="Category Name">{category.name}</td>
                <td className="category-table__stores" data-label="Stores">{storesLabel(category)}</td>
                <td className="category-table__task-count" data-label="Tasks">{category.taskCount}</td>
                <td data-label="Status">
                  {canManage && onToggleStatus ? (
                    <Toggle
                      checked={category.active}
                      onChange={(checked) => onToggleStatus(category, checked)}
                      label={`${category.active ? 'Deactivate' : 'Activate'} ${category.name}`}
                    />
                  ) : (
                    <span className={`category-table__status-badge ${category.active ? 'is-active' : 'is-inactive'}`}>
                      {category.active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </td>
                {canManage && (
                  <td className="table-actions-cell" data-label="Actions">
                    <div className="table-row-actions">
                      <button
                        type="button"
                        className="table-icon-btn"
                        aria-label={`Edit ${category.name}`}
                        title="Edit"
                        onClick={() => onEdit?.(category)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="table-icon-btn table-icon-btn--danger"
                        aria-label={`Delete ${category.name}`}
                        title="Delete"
                        onClick={() => onDelete?.(category)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isLoading && categories.length === 0 && (
        <div className="category-table__empty">No categories match your filters.</div>
      )}
      {isLoading && <div className="category-table__empty">Loading categories...</div>}
    </div>
  );
}

export default CategoryTable;
```

- [ ] **Step 2: Add the read-only status badge style**

Append to `frontend/src/components/CategoryTable.css`:

```css
.category-table__stores {
  color: var(--color-text-secondary);
}

.category-table__status-badge {
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 999px;
}

.category-table__status-badge.is-active {
  background: var(--color-badge-success-bg, #dcfce7);
  color: var(--color-badge-success-text, #166534);
}

.category-table__status-badge.is-inactive {
  background: var(--color-badge-neutral-bg, #f4f4f5);
  color: var(--color-badge-neutral-text, #71717a);
}
```

If `--color-badge-success-bg`/`--color-badge-success-text`/`--color-badge-neutral-bg`/`--color-badge-neutral-text` don't already exist as tokens (check `frontend/src/styles/tokens.css`), the `var(..., fallback)` syntax above keeps this working regardless — no further action needed either way.

- [ ] **Step 3: Add store assignment to `CategoryFormModal`**

Replace `frontend/src/components/CategoryFormModal.tsx` in full:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import type { CategoryFormValues, CategoryStoreOption } from '../types/category';
import Modal from './Modal';
import FormField from './FormField';
import CategoryStorePicker from './CategoryStorePicker';

interface CategoryFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialValues?: CategoryFormValues;
  availableStores: CategoryStoreOption[];
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: CategoryFormValues) => void;
}

const EMPTY_VALUES: CategoryFormValues = { name: '', appliesToAllStores: true, storeIds: [] };

function CategoryFormModal({
  isOpen,
  mode,
  initialValues,
  availableStores,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: CategoryFormModalProps) {
  const [values, setValues] = useState<CategoryFormValues>(initialValues ?? EMPTY_VALUES);
  const [validationError, setValidationError] = useState<string | undefined>();

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues ?? EMPTY_VALUES);
      setValidationError(undefined);
    }
  }, [isOpen, initialValues]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!values.name.trim()) {
      setValidationError('Name is required');
      return;
    }
    if (!values.appliesToAllStores && values.storeIds.length === 0) {
      setValidationError('Select at least one store, or choose All Stores');
      return;
    }
    onSubmit({ ...values, name: values.name.trim() });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Add Category' : 'Edit Category'}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="category-form" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Add Category' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Category Name" htmlFor="category-name" error={validationError}>
          <input
            id="category-name"
            className="input"
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            placeholder="e.g. Opening, Cleaning, Closing"
            autoFocus
          />
        </FormField>
        <FormField label="Applies To" htmlFor="category-stores">
          <CategoryStorePicker
            stores={availableStores}
            value={{ appliesToAllStores: values.appliesToAllStores, storeIds: values.storeIds }}
            onChange={(next) => setValues((current) => ({ ...current, ...next }))}
          />
        </FormField>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default CategoryFormModal;
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: FAILS — `Categories.tsx` still calls `<CategoryTable>`/`<CategoryFormModal>` with the old prop shapes. Expected; Task 10 fixes it.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CategoryTable.tsx frontend/src/components/CategoryTable.css frontend/src/components/CategoryFormModal.tsx
git commit -m "Make CategoryTable role-aware and add store picker to CategoryFormModal"
```

---

## Task 10: Owner Admin Categories page becomes read-only

**Files:**
- Modify: `frontend/src/pages/Categories.tsx`

**Interfaces:**
- Consumes: `CategoryTable` (Task 9, with `canManage={false}`).
- Produces: same exported `Categories` component, with a much smaller `CategoriesProps` (no form/delete/status handling left).

- [ ] **Step 1: Replace the file**

Replace `frontend/src/pages/Categories.tsx` in full:

```tsx
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Tags, CircleCheck, CircleSlash } from 'lucide-react';
import type { Category } from '../types/category';
import CategoryTable from '../components/CategoryTable';
import SearchInput from '../components/SearchInput';
import Select from '../components/Select';
import StatCard from '../components/StatCard';
import './Categories.css';

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

interface CategoriesProps {
  categories: Category[];
  setCategories: Dispatch<SetStateAction<Category[]>>;
  isLoading: boolean;
  loadError: string | null;
  onRetry: () => void;
  searchSeed?: { term: string; id: number };
}

// Read-only for Owner Admin: category creation, editing, activation, and
// deletion are Super-Admin-only. This page shows whichever categories apply
// to this owner's store(s), including ones Super Admin created and assigned.
function Categories({ categories, isLoading, loadError, onRetry, searchSeed }: CategoriesProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const appliedSeedId = useRef<number | null>(null);
  useEffect(() => {
    if (searchSeed && searchSeed.id !== appliedSeedId.current) {
      appliedSeedId.current = searchSeed.id;
      setSearch(searchSeed.term);
    }
  }, [searchSeed]);

  const activeCount = useMemo(() => categories.filter((category) => category.active).length, [categories]);

  const filteredCategories = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return categories.filter((category) => {
      if (normalizedSearch && !category.name.toLowerCase().includes(normalizedSearch)) return false;
      if (statusFilter === 'ACTIVE' && !category.active) return false;
      if (statusFilter === 'INACTIVE' && category.active) return false;
      return true;
    });
  }, [categories, search, statusFilter]);

  return (
    <div className="categories-page">
      <div className="stat-card-row">
        <StatCard icon={Tags} label="Total Categories" value={categories.length} tone="primary" />
        <StatCard icon={CircleCheck} label="Active" value={activeCount} tone="success" />
        <StatCard icon={CircleSlash} label="Inactive" value={categories.length - activeCount} tone="warning" />
      </div>

      <div className="categories-page__header">
        <p className="categories-page__summary">
          {isLoading
            ? 'Loading categories...'
            : `${activeCount} active categor${activeCount === 1 ? 'y' : 'ies'} of ${categories.length} total`}
        </p>
      </div>

      {loadError ? (
        <div className="categories-page__error">
          {loadError}
          <button type="button" className="btn btn--secondary" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="filter-bar">
            <div className="filter filter--search">
              <SearchInput value={search} onChange={setSearch} placeholder="Search categories" variant="filter" />
            </div>
            <Select
              className="filter filter--narrow"
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              ariaLabel="Filter by status"
            />
          </div>

          <CategoryTable categories={filteredCategories} canManage={false} isLoading={isLoading} />
        </>
      )}
    </div>
  );
}

export default Categories;
```

Note `setCategories` stays in `CategoriesProps` (unused inside the component body) only if `DashboardShell.tsx` still passes it from `useOwnerCategories`'s shared state — check that call site in Step 2 below; if it becomes genuinely unused there too, it's fine to leave the prop typed-but-unused here since `useOwnerCategories`'s return type requires a consumer, but simplest is to just not destructure it (already done above by omitting it from the destructure while keeping it in the interface, which satisfies TypeScript without an "unused variable" error since it's never bound to a name).

- [ ] **Step 2: Confirm `DashboardShell.tsx` needs no changes**

`frontend/src/layouts/DashboardShell.tsx`'s existing `case 'categories':` block already only passes `categories`, `setCategories`, `isLoading`, `loadError`, `onRetry`, `searchSeed` — exactly the props `Categories` still accepts. No changes needed here.

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: SUCCESS.

- [ ] **Step 4: Manual smoke test**

Run: `cd frontend && npm run dev` (and the backend, if not already running). Log in as an Owner Admin and open Categories: confirm there's no Add button, no Edit/Delete icons, and Status renders as a plain Active/Inactive badge rather than a toggle.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Categories.tsx
git commit -m "Make Owner Admin Categories page read-only"
```

---

## Task 11: Super Admin Categories page

**Files:**
- Create: `frontend/src/hooks/useSuperAdminCategories.ts`
- Create: `frontend/src/pages/SuperAdminCategories.tsx`
- Modify: `frontend/src/types/navigation.ts`
- Modify: `frontend/src/pages/SuperAdminDashboard.tsx`

**Interfaces:**
- Consumes: `Category`/`CategoryFormValues`/`CategoryStoreOption` (Task 7), `CategoryFormModal`/`CategoryTable` (Task 9, with `canManage={true}`), `getOwners()` (existing, `frontend/src/api/owners.ts`, returns `OwnerSummary[]` with `storeId`/`storeName` per row — used here to build the platform-wide store list for the picker), `getCategories`/`createCategory`/`updateCategory`/`updateCategoryStatus`/`deleteCategory` (Task 7 — the backend endpoints they call are now Super-Admin-only, matching this page's exclusive use of them).

- [ ] **Step 1: Write the hook**

```ts
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { getCategories } from '../api/categories';
import type { Category } from '../types/category';

interface SuperAdminCategoriesState {
  categories: Category[];
  setCategories: Dispatch<SetStateAction<Category[]>>;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

export function useSuperAdminCategories(): SuperAdminCategoriesState {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    getCategories()
      .then((result) => {
        if (active) setCategories(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Failed to load categories');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadToken]);

  return { categories, setCategories, isLoading, error, reload };
}
```

- [ ] **Step 2: Write the page**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Plus, Tags, CircleCheck, CircleSlash } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { createCategory, updateCategory, updateCategoryStatus, deleteCategory } from '../api/categories';
import { getOwners } from '../api/owners';
import { useSuperAdminCategories } from '../hooks/useSuperAdminCategories';
import type { Category, CategoryFormValues, CategoryStoreOption } from '../types/category';
import CategoryTable from '../components/CategoryTable';
import CategoryFormModal from '../components/CategoryFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchInput from '../components/SearchInput';
import Select from '../components/Select';
import SpecularButton from '../components/SpecularButton';
import StatCard from '../components/StatCard';
import '../pages/Categories.css';

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type FormModalState = { mode: 'create' } | { mode: 'edit'; category: Category } | null;

function SuperAdminCategories() {
  const { categories, setCategories, isLoading, error: loadError, reload } = useSuperAdminCategories();
  const [allStores, setAllStores] = useState<CategoryStoreOption[]>([]);

  useEffect(() => {
    getOwners()
      .then((owners) => {
        const byId = new Map<number, CategoryStoreOption>();
        owners.forEach((owner) => {
          if (owner.storeId != null && owner.storeName != null) {
            byId.set(owner.storeId, { id: owner.storeId, name: owner.storeName });
          }
        });
        setAllStores(Array.from(byId.values()));
      })
      .catch(() => setAllStores([]));
  }, []);

  const [formModalState, setFormModalState] = useState<FormModalState>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  async function handleFormSubmit(values: CategoryFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (formModalState?.mode === 'edit') {
        const updated = await updateCategory(formModalState.category.id, values);
        setCategories((current) => current.map((c) => (c.id === updated.id ? updated : c)));
        nfToast.success(`"${updated.name}" category updated.`);
      } else {
        const created = await createCategory(values);
        setCategories((current) => [...current, created]);
        nfToast.success(`"${created.name}" category added.`);
      }
      setFormModalState(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      setFormError(msg);
      nfToast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleStatus(category: Category, active: boolean) {
    setStatusError(null);
    setCategories((current) => current.map((c) => (c.id === category.id ? { ...c, active } : c)));
    try {
      const updated = await updateCategoryStatus(category.id, active);
      setCategories((current) => current.map((c) => (c.id === updated.id ? updated : c)));
      nfToast.success(`"${category.name}" category ${active ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      setCategories((current) => current.map((c) => (c.id === category.id ? category : c)));
      const msg = error instanceof Error ? error.message : 'Failed to update category status';
      setStatusError(msg);
      nfToast.error(msg);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteCategory(deleteTarget.id);
      setCategories((current) => current.filter((c) => c.id !== deleteTarget.id));
      const deletedName = deleteTarget.name;
      setDeleteTarget(null);
      nfToast.success(`"${deletedName}" category deleted.`);
    } catch (error) {
      setDeleteTarget(null);
      const msg = error instanceof Error ? error.message : 'Failed to delete category';
      setDeleteError(msg);
      nfToast.error(msg);
    }
  }

  const activeCount = useMemo(() => categories.filter((category) => category.active).length, [categories]);

  const filteredCategories = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return categories.filter((category) => {
      if (normalizedSearch && !category.name.toLowerCase().includes(normalizedSearch)) return false;
      if (statusFilter === 'ACTIVE' && !category.active) return false;
      if (statusFilter === 'INACTIVE' && category.active) return false;
      return true;
    });
  }, [categories, search, statusFilter]);

  return (
    <div className="categories-page">
      <div className="stat-card-row">
        <StatCard icon={Tags} label="Total Categories" value={categories.length} tone="primary" />
        <StatCard icon={CircleCheck} label="Active" value={activeCount} tone="success" />
        <StatCard icon={CircleSlash} label="Inactive" value={categories.length - activeCount} tone="warning" />
      </div>

      {deleteError && <div className="categories-page__error">{deleteError}</div>}
      {statusError && <div className="categories-page__error">{statusError}</div>}

      <div className="categories-page__header">
        <p className="categories-page__summary">
          {isLoading
            ? 'Loading categories...'
            : `${activeCount} active categor${activeCount === 1 ? 'y' : 'ies'} of ${categories.length} total`}
        </p>
        <SpecularButton
          size="sm"
          radius={999}
          tint="var(--color-badge-solid-bg)"
          tintOpacity={1}
          textColor="var(--color-badge-solid-text)"
          lineColor="#e11d33"
          baseColor="#e4e4e7"
          followMouse
          proximity={180}
          onClick={() => {
            setFormError(null);
            setFormModalState({ mode: 'create' });
          }}
        >
          <span className="categories-page__add-label">
            <Plus size={16} />
            Add Category
          </span>
        </SpecularButton>
      </div>

      {loadError ? (
        <div className="categories-page__error">
          {loadError}
          <button type="button" className="btn btn--secondary" onClick={reload}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="filter-bar">
            <div className="filter filter--search">
              <SearchInput value={search} onChange={setSearch} placeholder="Search categories" variant="filter" />
            </div>
            <Select
              className="filter filter--narrow"
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              ariaLabel="Filter by status"
            />
          </div>

          <CategoryTable
            categories={filteredCategories}
            canManage
            isLoading={isLoading}
            onEdit={(category) => {
              setFormError(null);
              setFormModalState({ mode: 'edit', category });
            }}
            onDelete={(category) => {
              setDeleteError(null);
              setDeleteTarget(category);
            }}
            onToggleStatus={handleToggleStatus}
          />
        </>
      )}

      <CategoryFormModal
        isOpen={formModalState !== null}
        mode={formModalState?.mode ?? 'create'}
        initialValues={
          formModalState?.mode === 'edit'
            ? {
                name: formModalState.category.name,
                appliesToAllStores: formModalState.category.appliesToAllStores,
                storeIds: formModalState.category.stores.map((s) => s.id),
              }
            : undefined
        }
        availableStores={allStores}
        errorMessage={formError}
        isSubmitting={isSubmitting}
        onClose={() => setFormModalState(null)}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Category"
        message={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.name}? This cannot be undone.`
            : ''
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default SuperAdminCategories;
```

- [ ] **Step 3: Add the nav tab**

In `frontend/src/types/navigation.ts`, change the `SuperAdminNavTabKey` union and both constants:

```ts
export type SuperAdminNavTabKey = 'home' | 'owners' | 'stores' | 'employees' | 'categories' | 'checklist' | 'issues' | 'inventory';

export const SUPER_ADMIN_NAV_ITEMS: NavItem<SuperAdminNavTabKey>[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'owners', label: 'Owners', icon: Building2 },
  { key: 'stores', label: 'Stores', icon: Store },
  { key: 'employees', label: 'Employees', icon: Users },
  { key: 'categories', label: 'Categories', icon: Tags },
  { key: 'checklist', label: 'Daily Checklist', icon: ClipboardList },
  { key: 'inventory', label: 'Inventory', icon: Package },
];

export const SUPER_ADMIN_PAGE_TITLES: Record<SuperAdminNavTabKey, string> = {
  home: 'Home',
  owners: 'Owners',
  stores: 'Stores',
  employees: 'Employees',
  categories: 'Categories',
  checklist: 'Daily Checklist',
  issues: 'Issues',
  inventory: 'Inventory',
};
```

(`Tags` is already imported in this file for `OWNER_NAV_ITEMS` — no new import needed.)

- [ ] **Step 4: Wire the page into `SuperAdminDashboard.tsx`**

Add the import: `import SuperAdminCategories from '../pages/SuperAdminCategories';`. In the tab-render ladder (after the `activeTab === 'employees'` branch), add:

```tsx
      ) : activeTab === 'categories' ? (
        <SuperAdminCategories />
```

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: SUCCESS.

- [ ] **Step 6: Manual smoke test**

Run: `cd frontend && npm run dev`. Log in as Super Admin, open the new Categories tab, create a category assigned to a specific store, confirm it shows up read-only when logging in as that store's Owner Admin (no Edit/Delete/Toggle, just the name/stores/task-count/status badge). Then edit it to "All Stores" and confirm the Owner Admin's list still shows it. Then deactivate it and confirm the Owner Admin's status badge flips to "Inactive". Finally delete it and confirm it disappears for the Owner Admin on reload.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useSuperAdminCategories.ts frontend/src/pages/SuperAdminCategories.tsx frontend/src/types/navigation.ts frontend/src/pages/SuperAdminDashboard.tsx
git commit -m "Add Super Admin Categories page with platform-wide store assignment"
```
