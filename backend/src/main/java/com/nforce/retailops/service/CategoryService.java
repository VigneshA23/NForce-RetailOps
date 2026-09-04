package com.nforce.retailops.service;

import com.nforce.retailops.dto.CategoryRequest;
import com.nforce.retailops.dto.CategoryResponse;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.exception.CategoryNameExistsException;
import com.nforce.retailops.exception.CategoryNotFoundException;
import com.nforce.retailops.exception.InvalidCategoryOrderException;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final TaskRepository taskRepository;

    public CategoryService(
        CategoryRepository categoryRepository,
        UserRepository userRepository,
        TaskRepository taskRepository
    ) {
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
        this.taskRepository = taskRepository;
    }

    private CategoryResponse toResponse(Category category) {
        return CategoryResponse.from(category, taskRepository.countByCategoryId(category.getId()));
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> listCategories(Long ownerId) {
        // One round trip instead of two (fetch categories, then a separate
        // batched task-count query): findOwnerCategorySummaryRows
        // pre-aggregates the task count in its own subquery and joins it in
        // server-side. Each round trip to the database has a real, fixed
        // network cost here, so collapsing two into one is a direct win
        // independent of how fast any single query runs.
        return categoryRepository.findOwnerCategorySummaryRows(ownerId).stream()
            .map(row -> new CategoryResponse(
                ((Number) row[0]).longValue(),
                (String) row[1],
                ((Number) row[2]).intValue(),
                (Boolean) row[3],
                ((Number) row[4]).intValue()
            ))
            .toList();
    }

    @Transactional
    public CategoryResponse createCategory(Long ownerId, CategoryRequest request) {
        String name = request.name().trim();

        if (categoryRepository.existsByOwnerIdAndNameIgnoreCase(ownerId, name)) {
            throw new CategoryNameExistsException("A category with this name already exists");
        }

        Category category = new Category();
        category.setOwner(userRepository.getReferenceById(ownerId));
        category.setName(name);
        category.setDisplayOrder(categoryRepository.countByOwnerId(ownerId));
        category = categoryRepository.save(category);

        return toResponse(category);
    }

    @Transactional
    public CategoryResponse updateCategory(Long ownerId, Long categoryId, CategoryRequest request) {
        String name = request.name().trim();

        Category category = categoryRepository.findByIdAndOwnerId(categoryId, ownerId)
            .orElseThrow(() -> new CategoryNotFoundException("Category not found"));

        if (categoryRepository.existsByOwnerIdAndNameIgnoreCaseAndIdNot(ownerId, name, categoryId)) {
            throw new CategoryNameExistsException("A category with this name already exists");
        }

        category.setName(name);
        category = categoryRepository.save(category);

        return toResponse(category);
    }

    @Transactional
    public CategoryResponse setActive(Long ownerId, Long categoryId, boolean active) {
        Category category = categoryRepository.findByIdAndOwnerId(categoryId, ownerId)
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

    // Takes the owner's FULL category id list, in the desired order, rather
    // than a from/to index pair -- simpler to reason about (and to validate
    // completely: every one of the owner's categories accounted for, no
    // stray/foreign ids) than reconstructing a move from a partial delta, and
    // matches what a drag-and-drop list naturally has on hand after a drop.
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

    @Transactional
    public void deleteCategory(Long ownerId, Long categoryId) {
        Category category = categoryRepository.findByIdAndOwnerId(categoryId, ownerId)
            .orElseThrow(() -> new CategoryNotFoundException("Category not found"));

        categoryRepository.delete(category);
    }
}
