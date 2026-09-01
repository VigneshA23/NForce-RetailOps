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

import java.util.List;

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
        return categoryRepository.findByOwnerIdOrderByDisplayOrderAsc(ownerId).stream()
            .map(this::toResponse)
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
