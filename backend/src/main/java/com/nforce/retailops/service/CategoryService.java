package com.nforce.retailops.service;

import com.nforce.retailops.dto.CategoryRequest;
import com.nforce.retailops.dto.CategoryResponse;
import com.nforce.retailops.entity.Category;
import com.nforce.retailops.exception.CategoryNameExistsException;
import com.nforce.retailops.exception.CategoryNotFoundException;
import com.nforce.retailops.repository.CategoryRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
        List<Category> categories = categoryRepository.findByOwnerIdOrderByDisplayOrderAsc(ownerId);

        // One grouped count query for the whole list, instead of one
        // countByCategoryId query per category (N+1).
        List<Long> categoryIds = categories.stream().map(Category::getId).toList();
        Map<Long, Integer> taskCounts = new HashMap<>();
        if (!categoryIds.isEmpty()) {
            for (Object[] row : taskRepository.countGroupedByCategoryIds(categoryIds)) {
                taskCounts.put((Long) row[0], ((Long) row[1]).intValue());
            }
        }

        return categories.stream()
            .map(category -> CategoryResponse.from(category, taskCounts.getOrDefault(category.getId(), 0)))
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

        return toResponse(category);
    }

    @Transactional
    public void deleteCategory(Long ownerId, Long categoryId) {
        Category category = categoryRepository.findByIdAndOwnerId(categoryId, ownerId)
            .orElseThrow(() -> new CategoryNotFoundException("Category not found"));

        categoryRepository.delete(category);
    }
}
