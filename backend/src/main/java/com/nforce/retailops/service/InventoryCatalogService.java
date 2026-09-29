package com.nforce.retailops.service;

import com.nforce.retailops.dto.InventoryCategoryRequest;
import com.nforce.retailops.dto.InventoryCategoryResponse;
import com.nforce.retailops.entity.InventoryCategory;
import com.nforce.retailops.exception.InventoryCategoryNotFoundException;
import com.nforce.retailops.repository.InventoryCategoryRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

// Super Admin's shared inventory-category picklist (Phase 2). Reused as a
// reference list by every store's own inventory items -- see
// StoreInventoryItemService.
@Service
public class InventoryCatalogService {

    private final InventoryCategoryRepository categoryRepository;
    private final StoreInventoryItemRepository storeInventoryItemRepository;

    public InventoryCatalogService(
        InventoryCategoryRepository categoryRepository,
        StoreInventoryItemRepository storeInventoryItemRepository
    ) {
        this.categoryRepository = categoryRepository;
        this.storeInventoryItemRepository = storeInventoryItemRepository;
    }

    @Transactional(readOnly = true)
    public List<InventoryCategoryResponse> listCategories() {
        return categoryRepository.findAllByOrderByDisplayOrderAsc().stream()
            .map(category -> InventoryCategoryResponse.from(category, (int) storeInventoryItemRepository.countByCategoryId(category.getId())))
            .toList();
    }

    // Read-only, active-only variant for Owner/Admin's inventory item
    // create/edit form dropdown -- they can't reach the Super-Admin-only
    // listCategories() endpoint.
    @Transactional(readOnly = true)
    public List<InventoryCategoryResponse> listActiveCategories() {
        return categoryRepository.findByActiveTrueOrderByDisplayOrderAsc().stream()
            .map(category -> InventoryCategoryResponse.from(category, (int) storeInventoryItemRepository.countByCategoryId(category.getId())))
            .toList();
    }

    @Transactional
    public InventoryCategoryResponse createCategory(InventoryCategoryRequest request) {
        InventoryCategory category = new InventoryCategory();
        category.setName(request.name().trim());
        category.setDisplayOrder((int) categoryRepository.count());
        category = categoryRepository.save(category);
        return InventoryCategoryResponse.from(category, 0);
    }

    @Transactional
    public InventoryCategoryResponse updateCategory(Long categoryId, InventoryCategoryRequest request) {
        InventoryCategory category = categoryRepository.findById(categoryId)
            .orElseThrow(() -> new InventoryCategoryNotFoundException("Inventory category not found"));
        category.setName(request.name().trim());
        category = categoryRepository.save(category);
        return InventoryCategoryResponse.from(category, (int) storeInventoryItemRepository.countByCategoryId(categoryId));
    }

    @Transactional
    public InventoryCategoryResponse setCategoryActive(Long categoryId, boolean active) {
        InventoryCategory category = categoryRepository.findById(categoryId)
            .orElseThrow(() -> new InventoryCategoryNotFoundException("Inventory category not found"));
        category.setActive(active);
        category = categoryRepository.save(category);
        return InventoryCategoryResponse.from(category, (int) storeInventoryItemRepository.countByCategoryId(categoryId));
    }
}
