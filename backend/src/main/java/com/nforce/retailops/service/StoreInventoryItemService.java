package com.nforce.retailops.service;

import com.nforce.retailops.dto.StoreInventoryItemRequest;
import com.nforce.retailops.dto.StoreInventoryItemResponse;
import com.nforce.retailops.entity.InventoryCategory;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.exception.InventoryCategoryNotFoundException;
import com.nforce.retailops.exception.StoreInventoryItemHasHistoryException;
import com.nforce.retailops.exception.StoreInventoryItemNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.exception.SupplierNotFoundException;
import com.nforce.retailops.repository.InventoryCategoryRepository;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

// Full CRUD for a store's own inventory items (Phase 2 redesign). Split into
// an Owner/Admin section (scoped to the caller's own store) and a Super
// Admin section (any store, store id supplied explicitly) -- same structural
// split as CategoryService.
@Service
public class StoreInventoryItemService {

    private final StoreInventoryItemRepository storeInventoryItemRepository;
    private final InventoryCategoryRepository categoryRepository;
    private final SupplierRepository supplierRepository;
    private final StoreRepository storeRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StockCheckRepository stockCheckRepository;
    private final OrderListEntryRepository orderListEntryRepository;

    public StoreInventoryItemService(
        StoreInventoryItemRepository storeInventoryItemRepository,
        InventoryCategoryRepository categoryRepository,
        SupplierRepository supplierRepository,
        StoreRepository storeRepository,
        StoreOwnerRepository storeOwnerRepository,
        StockCheckRepository stockCheckRepository,
        OrderListEntryRepository orderListEntryRepository
    ) {
        this.storeInventoryItemRepository = storeInventoryItemRepository;
        this.categoryRepository = categoryRepository;
        this.supplierRepository = supplierRepository;
        this.storeRepository = storeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.stockCheckRepository = stockCheckRepository;
        this.orderListEntryRepository = orderListEntryRepository;
    }

    // ---------------------------------------------------------------------
    // Owner Admin -- scoped to the caller's own store.
    // ---------------------------------------------------------------------

    // Picks the caller's active store the same multi-store-safe way
    // CategoryService.ownerStoreIds does (findByOwnerId + filter isActive),
    // rather than the crash-prone findByOwnerIdAndActiveTrue (which assumes
    // exactly one row and throws for an owner with more than one). Picking
    // the first active store matches the rest of the Owner/Admin dashboard,
    // which already assumes a single "current" store per owner.
    private Store requireOwnerStore(Long ownerId) {
        return storeOwnerRepository.findByOwnerId(ownerId).stream()
            .filter(StoreOwner::isActive)
            .findFirst()
            .map(StoreOwner::getStore)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
    }

    @Transactional(readOnly = true)
    public List<StoreInventoryItemResponse> listForOwner(Long ownerId) {
        Store store = requireOwnerStore(ownerId);
        return storeInventoryItemRepository.findByStoreIdOrderById(store.getId()).stream()
            .map(StoreInventoryItemResponse::from)
            .toList();
    }

    @Transactional
    public StoreInventoryItemResponse createForOwner(Long ownerId, StoreInventoryItemRequest request) {
        Store store = requireOwnerStore(ownerId);
        return StoreInventoryItemResponse.from(createItem(store, request));
    }

    @Transactional
    public StoreInventoryItemResponse updateForOwner(Long ownerId, Long itemId, StoreInventoryItemRequest request) {
        Store store = requireOwnerStore(ownerId);
        StoreInventoryItem item = storeInventoryItemRepository.findByIdAndStoreId(itemId, store.getId())
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));
        return StoreInventoryItemResponse.from(applyUpdate(item, request));
    }

    @Transactional
    public StoreInventoryItemResponse setActiveForOwner(Long ownerId, Long itemId, boolean active) {
        Store store = requireOwnerStore(ownerId);
        StoreInventoryItem item = storeInventoryItemRepository.findByIdAndStoreId(itemId, store.getId())
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));
        item.setActive(active);
        return StoreInventoryItemResponse.from(storeInventoryItemRepository.save(item));
    }

    @Transactional
    public void deleteForOwner(Long ownerId, Long itemId) {
        Store store = requireOwnerStore(ownerId);
        StoreInventoryItem item = storeInventoryItemRepository.findByIdAndStoreId(itemId, store.getId())
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));
        deleteItem(item);
    }

    // ---------------------------------------------------------------------
    // Super Admin -- any store, store id supplied explicitly.
    // ---------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<StoreInventoryItemResponse> listAllForSuperAdmin() {
        return storeInventoryItemRepository.findAll().stream()
            .map(StoreInventoryItemResponse::from)
            .toList();
    }

    @Transactional
    public StoreInventoryItemResponse createForSuperAdmin(StoreInventoryItemRequest request) {
        if (request.storeId() == null) {
            throw new StoreNotFoundException("Store is required");
        }
        Store store = storeRepository.findById(request.storeId())
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        return StoreInventoryItemResponse.from(createItem(store, request));
    }

    @Transactional
    public StoreInventoryItemResponse updateForSuperAdmin(Long itemId, StoreInventoryItemRequest request) {
        StoreInventoryItem item = storeInventoryItemRepository.findById(itemId)
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));
        return StoreInventoryItemResponse.from(applyUpdate(item, request));
    }

    @Transactional
    public StoreInventoryItemResponse setActiveForSuperAdmin(Long itemId, boolean active) {
        StoreInventoryItem item = storeInventoryItemRepository.findById(itemId)
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));
        item.setActive(active);
        return StoreInventoryItemResponse.from(storeInventoryItemRepository.save(item));
    }

    @Transactional
    public void deleteForSuperAdmin(Long itemId) {
        StoreInventoryItem item = storeInventoryItemRepository.findById(itemId)
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));
        deleteItem(item);
    }

    // ---------------------------------------------------------------------
    // Shared helpers
    // ---------------------------------------------------------------------

    private StoreInventoryItem createItem(Store store, StoreInventoryItemRequest request) {
        StoreInventoryItem item = new StoreInventoryItem();
        item.setStore(store);
        applyFields(item, request);
        return storeInventoryItemRepository.save(item);
    }

    private StoreInventoryItem applyUpdate(StoreInventoryItem item, StoreInventoryItemRequest request) {
        applyFields(item, request);
        return storeInventoryItemRepository.save(item);
    }

    private void applyFields(StoreInventoryItem item, StoreInventoryItemRequest request) {
        InventoryCategory category = categoryRepository.findById(request.categoryId())
            .orElseThrow(() -> new InventoryCategoryNotFoundException("Inventory category not found"));

        item.setName(request.name().trim());
        item.setCategory(category);
        item.setUnitOfMeasurement(request.unitOfMeasurement().trim());
        item.setMinWeekday(request.minWeekday());
        item.setMinWeekend(request.minWeekend());
        item.setNote(request.note() != null ? request.note().trim() : null);

        if (request.preferredSupplierId() == null) {
            item.setPreferredSupplier(null);
        } else {
            Supplier supplier = supplierRepository.findById(request.preferredSupplierId())
                .orElseThrow(() -> new SupplierNotFoundException("Supplier not found"));
            item.setPreferredSupplier(supplier);
        }
    }

    // Mirrors TaskService.deleteTaskAsSuperAdmin's guard-then-delete shape:
    // block a hard delete when there's stock-check/order history to preserve,
    // and point the caller at deactivation instead.
    private void deleteItem(StoreInventoryItem item) {
        if (stockCheckRepository.existsByStoreInventoryItemId(item.getId())
            || orderListEntryRepository.existsByStoreInventoryItemId(item.getId())) {
            throw new StoreInventoryItemHasHistoryException(
                "This inventory item has stock-check or order history and cannot be deleted. Deactivate it instead.");
        }
        storeInventoryItemRepository.delete(item);
    }
}
