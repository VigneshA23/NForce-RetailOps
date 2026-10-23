package com.nforce.retailops.service;

import com.nforce.retailops.dto.InventoryCategoryDeleteResponse;
import com.nforce.retailops.dto.InventoryCategoryDetailsRequest;
import com.nforce.retailops.dto.InventoryCategoryResponse;
import com.nforce.retailops.entity.InventoryCategory;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.exception.InvalidStoreSelectionException;
import com.nforce.retailops.exception.InventoryCategoryNameExistsException;
import com.nforce.retailops.exception.InventoryCategoryNotFoundException;
import com.nforce.retailops.exception.StoreInactiveException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.InventoryCategoryRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

// Super Admin-managed inventory category catalog -- mirrors SupplierService's
// own split between the full Super Admin form and the Owner/Admin's
// store-scoped read access.
@Service
public class InventoryCategoryService {

    private final InventoryCategoryRepository inventoryCategoryRepository;
    private final StoreInventoryItemRepository storeInventoryItemRepository;
    private final StoreRepository storeRepository;
    private final StoreOwnerRepository storeOwnerRepository;

    public InventoryCategoryService(
        InventoryCategoryRepository inventoryCategoryRepository,
        StoreInventoryItemRepository storeInventoryItemRepository,
        StoreRepository storeRepository,
        StoreOwnerRepository storeOwnerRepository
    ) {
        this.inventoryCategoryRepository = inventoryCategoryRepository;
        this.storeInventoryItemRepository = storeInventoryItemRepository;
        this.storeRepository = storeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
    }

    @Transactional(readOnly = true)
    public List<InventoryCategoryResponse> listCategories() {
        return inventoryCategoryRepository.findAllByOrderByNameAsc().stream()
            .map(InventoryCategoryResponse::from)
            .toList();
    }

    // Owner/Admin's own add/edit item form: only categories actually usable at
    // this store (appliesToAllStores, or this store in Super Admin's
    // assignment list), active only -- same appliesToAllStores/getStores()
    // idiom SupplierService.listSuppliersForStore uses.
    @Transactional(readOnly = true)
    public List<InventoryCategoryResponse> listCategoriesForStore(Long ownerId) {
        Store store = requireOwnerStore(ownerId);
        return inventoryCategoryRepository.findAllByOrderByNameAsc().stream()
            .filter(InventoryCategory::isActive)
            .filter(category -> category.isAppliesToAllStores()
                || category.getStores().stream().anyMatch(s -> s.getId().equals(store.getId())))
            .map(InventoryCategoryResponse::from)
            .toList();
    }

    // Used by StoreInventoryItemService to validate an Owner/Admin's chosen
    // category is actually assigned to their store.
    @Transactional(readOnly = true)
    public boolean isCategoryAssignedToStore(String categoryName, Store store) {
        return inventoryCategoryRepository.findAllByOrderByNameAsc().stream()
            .filter(InventoryCategory::isActive)
            .filter(category -> category.getName().equalsIgnoreCase(categoryName))
            .anyMatch(category -> category.isAppliesToAllStores()
                || category.getStores().stream().anyMatch(s -> s.getId().equals(store.getId())));
    }

    private Store requireOwnerStore(Long ownerId) {
        return storeOwnerRepository.findByOwnerId(ownerId).stream()
            .filter(StoreOwner::isActive)
            .findFirst()
            .map(StoreOwner::getStore)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
    }

    @Transactional
    public InventoryCategoryResponse createCategory(InventoryCategoryDetailsRequest request) {
        String name = request.name().trim();
        if (inventoryCategoryRepository.existsByNameIgnoreCase(name)) {
            throw new InventoryCategoryNameExistsException("A category with this name already exists.");
        }
        InventoryCategory category = new InventoryCategory();
        category.setName(name);
        applyDetails(category, request);
        category = inventoryCategoryRepository.save(category);
        return InventoryCategoryResponse.from(category);
    }

    @Transactional
    public InventoryCategoryResponse updateCategory(Long categoryId, InventoryCategoryDetailsRequest request) {
        InventoryCategory category = inventoryCategoryRepository.findById(categoryId)
            .orElseThrow(() -> new InventoryCategoryNotFoundException("Category not found"));
        String name = request.name().trim();
        if (inventoryCategoryRepository.existsByNameIgnoreCaseAndIdNot(name, categoryId)) {
            throw new InventoryCategoryNameExistsException("A category with this name already exists.");
        }
        category.setName(name);
        applyDetails(category, request);
        category = inventoryCategoryRepository.save(category);
        return InventoryCategoryResponse.from(category);
    }

    private void applyDetails(InventoryCategory category, InventoryCategoryDetailsRequest request) {
        category.setAppliesToAllStores(request.appliesToAllStores());
        category.setStores(resolveAnyStores(request.appliesToAllStores(), request.storeIds()));
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

    @Transactional
    public InventoryCategoryResponse setCategoryActive(Long categoryId, boolean active) {
        InventoryCategory category = inventoryCategoryRepository.findById(categoryId)
            .orElseThrow(() -> new InventoryCategoryNotFoundException("Category not found"));
        category.setActive(active);
        category = inventoryCategoryRepository.save(category);
        return InventoryCategoryResponse.from(category);
    }

    // Items using this category (by name, case-insensitive -- there is no FK,
    // the item's own category stays a free-text field) keep their value
    // either way. A category still in use is only deactivated so those items
    // aren't left referencing a deleted row's name with no explanation.
    @Transactional
    public InventoryCategoryDeleteResponse deleteCategory(Long categoryId) {
        InventoryCategory category = inventoryCategoryRepository.findById(categoryId)
            .orElseThrow(() -> new InventoryCategoryNotFoundException("Category not found"));
        if (storeInventoryItemRepository.existsByCategoryIgnoreCase(category.getName())) {
            category.setActive(false);
            inventoryCategoryRepository.save(category);
            return new InventoryCategoryDeleteResponse(false, true);
        }
        inventoryCategoryRepository.delete(category);
        return new InventoryCategoryDeleteResponse(true, false);
    }
}
