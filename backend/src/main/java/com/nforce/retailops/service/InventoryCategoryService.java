package com.nforce.retailops.service;

import com.nforce.retailops.dto.InventoryCategoryRequest;
import com.nforce.retailops.dto.InventoryCategoryResponse;
import com.nforce.retailops.entity.InventoryCategory;
import com.nforce.retailops.exception.InventoryCategoryNotFoundException;
import com.nforce.retailops.repository.InventoryCategoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class InventoryCategoryService {

    private final InventoryCategoryRepository inventoryCategoryRepository;

    public InventoryCategoryService(InventoryCategoryRepository inventoryCategoryRepository) {
        this.inventoryCategoryRepository = inventoryCategoryRepository;
    }

    @Transactional(readOnly = true)
    public List<InventoryCategoryResponse> listCategories() {
        return inventoryCategoryRepository.findAllByOrderByNameAsc().stream()
            .map(InventoryCategoryResponse::from)
            .toList();
    }

    @Transactional
    public InventoryCategoryResponse createCategory(InventoryCategoryRequest request) {
        InventoryCategory category = new InventoryCategory();
        category.setName(request.name().trim());
        category = inventoryCategoryRepository.save(category);
        return InventoryCategoryResponse.from(category);
    }

    // Backs the inline "Add New Category" option in the inventory item form.
    // inventory_categories.name has no unique constraint, so reuse an existing
    // category with the same name (case-insensitive) rather than creating a
    // duplicate, reactivating it if it had been deactivated.
    @Transactional
    public InventoryCategoryResponse findOrCreateCategory(InventoryCategoryRequest request) {
        String name = request.name().trim();
        InventoryCategory category = inventoryCategoryRepository.findFirstByNameIgnoreCaseOrderByIdAsc(name)
            .map(existing -> {
                if (!existing.isActive()) {
                    existing.setActive(true);
                    return inventoryCategoryRepository.save(existing);
                }
                return existing;
            })
            .orElseGet(() -> {
                InventoryCategory created = new InventoryCategory();
                created.setName(name);
                return inventoryCategoryRepository.save(created);
            });
        return InventoryCategoryResponse.from(category);
    }

    @Transactional
    public InventoryCategoryResponse updateCategory(Long categoryId, InventoryCategoryRequest request) {
        InventoryCategory category = inventoryCategoryRepository.findById(categoryId)
            .orElseThrow(() -> new InventoryCategoryNotFoundException("Category not found"));
        category.setName(request.name().trim());
        category = inventoryCategoryRepository.save(category);
        return InventoryCategoryResponse.from(category);
    }

    @Transactional
    public InventoryCategoryResponse setCategoryActive(Long categoryId, boolean active) {
        InventoryCategory category = inventoryCategoryRepository.findById(categoryId)
            .orElseThrow(() -> new InventoryCategoryNotFoundException("Category not found"));
        category.setActive(active);
        category = inventoryCategoryRepository.save(category);
        return InventoryCategoryResponse.from(category);
    }
}
