package com.nforce.retailops.service;

import com.nforce.retailops.dto.AssignInventoryItemRequest;
import com.nforce.retailops.dto.InventoryCategoryRequest;
import com.nforce.retailops.dto.InventoryCategoryResponse;
import com.nforce.retailops.dto.InventoryItemRequest;
import com.nforce.retailops.dto.InventoryItemResponse;
import com.nforce.retailops.dto.StoreInventoryItemResponse;
import com.nforce.retailops.entity.InventoryCategory;
import com.nforce.retailops.entity.InventoryItem;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.exception.InventoryCategoryNotFoundException;
import com.nforce.retailops.exception.InventoryItemAlreadyAssignedException;
import com.nforce.retailops.exception.InventoryItemNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.InventoryCategoryRepository;
import com.nforce.retailops.repository.InventoryItemRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

// Super Admin's Phase 2 catalog management: global inventory categories,
// global inventory items, and assigning items to individual stores.
@Service
public class InventoryCatalogService {

    private final InventoryCategoryRepository categoryRepository;
    private final InventoryItemRepository itemRepository;
    private final StoreRepository storeRepository;
    private final StoreInventoryItemRepository storeInventoryItemRepository;

    public InventoryCatalogService(
        InventoryCategoryRepository categoryRepository,
        InventoryItemRepository itemRepository,
        StoreRepository storeRepository,
        StoreInventoryItemRepository storeInventoryItemRepository
    ) {
        this.categoryRepository = categoryRepository;
        this.itemRepository = itemRepository;
        this.storeRepository = storeRepository;
        this.storeInventoryItemRepository = storeInventoryItemRepository;
    }

    // ---- Categories ----------------------------------------------------

    @Transactional(readOnly = true)
    public List<InventoryCategoryResponse> listCategories() {
        return categoryRepository.findAllByOrderByDisplayOrderAsc().stream()
            .map(category -> InventoryCategoryResponse.from(category, itemRepository.countByCategoryId(category.getId())))
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
        return InventoryCategoryResponse.from(category, itemRepository.countByCategoryId(categoryId));
    }

    @Transactional
    public InventoryCategoryResponse setCategoryActive(Long categoryId, boolean active) {
        InventoryCategory category = categoryRepository.findById(categoryId)
            .orElseThrow(() -> new InventoryCategoryNotFoundException("Inventory category not found"));
        category.setActive(active);
        category = categoryRepository.save(category);
        return InventoryCategoryResponse.from(category, itemRepository.countByCategoryId(categoryId));
    }

    // ---- Items -----------------------------------------------------------

    @Transactional(readOnly = true)
    public List<InventoryItemResponse> listItems() {
        return itemRepository.findAllByOrderByNameAsc().stream()
            .map(InventoryItemResponse::from)
            .toList();
    }

    @Transactional
    public InventoryItemResponse createItem(InventoryItemRequest request) {
        InventoryCategory category = categoryRepository.findById(request.categoryId())
            .orElseThrow(() -> new InventoryCategoryNotFoundException("Inventory category not found"));

        InventoryItem item = new InventoryItem();
        item.setCategory(category);
        item.setName(request.name().trim());
        item.setUnitOfMeasurement(request.unitOfMeasurement().trim());
        item = itemRepository.save(item);
        return InventoryItemResponse.from(item);
    }

    @Transactional
    public InventoryItemResponse updateItem(Long itemId, InventoryItemRequest request) {
        InventoryItem item = itemRepository.findById(itemId)
            .orElseThrow(() -> new InventoryItemNotFoundException("Inventory item not found"));
        InventoryCategory category = categoryRepository.findById(request.categoryId())
            .orElseThrow(() -> new InventoryCategoryNotFoundException("Inventory category not found"));

        item.setCategory(category);
        item.setName(request.name().trim());
        item.setUnitOfMeasurement(request.unitOfMeasurement().trim());
        item = itemRepository.save(item);
        return InventoryItemResponse.from(item);
    }

    @Transactional
    public InventoryItemResponse setItemActive(Long itemId, boolean active) {
        InventoryItem item = itemRepository.findById(itemId)
            .orElseThrow(() -> new InventoryItemNotFoundException("Inventory item not found"));
        item.setActive(active);
        item = itemRepository.save(item);
        return InventoryItemResponse.from(item);
    }

    // ---- Store assignment ------------------------------------------------

    @Transactional(readOnly = true)
    public List<StoreInventoryItemResponse> listAssignmentsForStore(Long storeId) {
        return storeInventoryItemRepository.findByStoreIdOrderById(storeId).stream()
            .map(StoreInventoryItemResponse::from)
            .toList();
    }

    // Creates the store<->item link only -- min levels and preferred supplier
    // are configured afterward by the store's Owner/Admin, never by Super Admin.
    @Transactional
    public StoreInventoryItemResponse assignItemToStore(AssignInventoryItemRequest request) {
        Store store = storeRepository.findById(request.storeId())
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        InventoryItem item = itemRepository.findById(request.inventoryItemId())
            .orElseThrow(() -> new InventoryItemNotFoundException("Inventory item not found"));

        if (storeInventoryItemRepository.existsByStoreIdAndInventoryItemId(store.getId(), item.getId())) {
            throw new InventoryItemAlreadyAssignedException("This item is already assigned to this store");
        }

        StoreInventoryItem assignment = new StoreInventoryItem();
        assignment.setStore(store);
        assignment.setInventoryItem(item);
        assignment = storeInventoryItemRepository.save(assignment);
        return StoreInventoryItemResponse.from(assignment);
    }
}
