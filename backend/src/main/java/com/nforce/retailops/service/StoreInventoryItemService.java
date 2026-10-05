package com.nforce.retailops.service;

import com.nforce.retailops.dto.StockLevelComparisonRowResponse;
import com.nforce.retailops.dto.StoreInventoryItemRequest;
import com.nforce.retailops.dto.StoreInventoryItemResponse;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.exception.StoreInventoryItemHasHistoryException;
import com.nforce.retailops.exception.StoreInventoryItemNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.exception.SupplierNotFoundException;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SupplierRepository;
import com.nforce.retailops.util.InventoryCountStatusCalculator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// Full CRUD for a store's own inventory items (Phase 2 redesign). Split into
// an Owner/Admin section (scoped to the caller's own store) and a Super
// Admin section (any store, store id supplied explicitly) -- same structural
// split as CategoryService.
@Service
public class StoreInventoryItemService {

    private final StoreInventoryItemRepository storeInventoryItemRepository;
    private final SupplierRepository supplierRepository;
    private final StoreRepository storeRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StockCheckRepository stockCheckRepository;
    private final OrderListEntryRepository orderListEntryRepository;
    private final ActivityLogService activityLogService;

    public StoreInventoryItemService(
        StoreInventoryItemRepository storeInventoryItemRepository,
        SupplierRepository supplierRepository,
        StoreRepository storeRepository,
        StoreOwnerRepository storeOwnerRepository,
        StockCheckRepository stockCheckRepository,
        OrderListEntryRepository orderListEntryRepository,
        ActivityLogService activityLogService
    ) {
        this.storeInventoryItemRepository = storeInventoryItemRepository;
        this.supplierRepository = supplierRepository;
        this.storeRepository = storeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.stockCheckRepository = stockCheckRepository;
        this.orderListEntryRepository = orderListEntryRepository;
        this.activityLogService = activityLogService;
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
        return toResponses(storeInventoryItemRepository.findByStoreIdOrderById(store.getId()));
    }

    @Transactional
    public StoreInventoryItemResponse createForOwner(Long ownerId, StoreInventoryItemRequest request) {
        Store store = requireOwnerStore(ownerId);
        return toResponse(createItem(store, request));
    }

    @Transactional
    public StoreInventoryItemResponse updateForOwner(Long ownerId, Long itemId, StoreInventoryItemRequest request) {
        Store store = requireOwnerStore(ownerId);
        StoreInventoryItem item = storeInventoryItemRepository.findByIdAndStoreId(itemId, store.getId())
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));
        return toResponse(applyUpdate(item, request));
    }

    @Transactional
    public StoreInventoryItemResponse setActiveForOwner(Long ownerId, Long itemId, boolean active) {
        Store store = requireOwnerStore(ownerId);
        StoreInventoryItem item = storeInventoryItemRepository.findByIdAndStoreId(itemId, store.getId())
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));
        item.setActive(active);
        return toResponse(storeInventoryItemRepository.save(item));
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
        return toResponses(storeInventoryItemRepository.findAll());
    }

    @Transactional
    public StoreInventoryItemResponse createForSuperAdmin(StoreInventoryItemRequest request) {
        if (request.storeId() == null) {
            throw new StoreNotFoundException("Store is required");
        }
        Store store = storeRepository.findById(request.storeId())
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        return toResponse(createItem(store, request));
    }

    @Transactional
    public StoreInventoryItemResponse updateForSuperAdmin(Long itemId, StoreInventoryItemRequest request) {
        StoreInventoryItem item = storeInventoryItemRepository.findById(itemId)
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));
        return toResponse(applyUpdate(item, request));
    }

    @Transactional
    public StoreInventoryItemResponse setActiveForSuperAdmin(Long itemId, boolean active) {
        StoreInventoryItem item = storeInventoryItemRepository.findById(itemId)
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));
        item.setActive(active);
        return toResponse(storeInventoryItemRepository.save(item));
    }

    @Transactional
    public void deleteForSuperAdmin(Long itemId) {
        StoreInventoryItem item = storeInventoryItemRepository.findById(itemId)
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));
        deleteItem(item);
    }

    // Every active store's current stock position for one item, matched by
    // case-insensitive name since there is no shared item catalog to join
    // on. A store with no (active) item of that name comes back with
    // assigned=false and every other field null rather than a misleading
    // zero. Reflects each store's latest submitted count, not just today's,
    // same staleness-aware tiering as the Owner/Admin Inventory Counts view
    // -- see InventoryCountStatusCalculator.
    @Transactional(readOnly = true)
    public List<StockLevelComparisonRowResponse> compareAcrossStores(String itemName) {
        List<Store> activeStores = storeRepository.findByActiveTrueOrderByName();

        // Nothing enforces one active item per name per store, so a store can
        // legitimately have two active "Milk"s (e.g. entered under different
        // categories). Pick the lowest id deterministically rather than
        // letting Collectors.toMap blow up on the duplicate key.
        Map<Long, StoreInventoryItem> itemByStoreId = storeInventoryItemRepository
            .findByNameIgnoreCase(itemName).stream()
            .filter(StoreInventoryItem::isActive)
            .collect(Collectors.toMap(
                item -> item.getStore().getId(),
                item -> item,
                (a, b) -> a.getId() <= b.getId() ? a : b
            ));

        List<Long> itemIds = itemByStoreId.values().stream().map(StoreInventoryItem::getId).toList();
        Map<Long, StockCheck> latestByItemId = itemIds.isEmpty()
            ? Map.of()
            : stockCheckRepository.findLatestPerItemForItemIds(itemIds).stream()
                .collect(Collectors.toMap(sc -> sc.getStoreInventoryItem().getId(), sc -> sc));

        LocalDate today = LocalDate.now();
        List<StockLevelComparisonRowResponse> rows = activeStores.stream()
            .map(store -> toComparisonRow(store, itemByStoreId.get(store.getId()), latestByItemId, today))
            .toList();

        activityLogService.logPlatform(
            "STOCK_LEVELS_COMPARED", "Super Admin", "SUPER_ADMIN",
            "INVENTORY_ITEM", itemName,
            "Compared stock levels for \"" + itemName + "\" across stores"
        );
        return rows;
    }

    private StockLevelComparisonRowResponse toComparisonRow(
        Store store, StoreInventoryItem item, Map<Long, StockCheck> latestByItemId, LocalDate today
    ) {
        if (item == null) {
            return new StockLevelComparisonRowResponse(store.getId(), store.getName(), false, null, null, null, null);
        }
        Integer minimum = item.requiredMinimumOn(today);
        StockCheck latest = latestByItemId.get(item.getId());
        return new StockLevelComparisonRowResponse(
            store.getId(), store.getName(), true, minimum,
            latest == null ? null : latest.getCurrentCount(),
            latest == null ? null : latest.getCheckDate(),
            InventoryCountStatusCalculator.calculate(latest, today, minimum)
        );
    }

    // ---------------------------------------------------------------------
    // Shared helpers
    // ---------------------------------------------------------------------

    // "Current available" is today's usable stock (available - dead) from the
    // latest snapshot -- End of Day once counted, else Start of Day -- which
    // StockCheck keeps in currentCount. One query for the whole list.
    private List<StoreInventoryItemResponse> toResponses(List<StoreInventoryItem> items) {
        LocalDate today = LocalDate.now();
        Map<Long, Integer> todaysCounts = stockCheckRepository
            .findByStoreInventoryItemIdInAndCheckDate(items.stream().map(StoreInventoryItem::getId).toList(), today)
            .stream()
            .collect(Collectors.toMap(sc -> sc.getStoreInventoryItem().getId(), StockCheck::getCurrentCount));
        return items.stream()
            .map(item -> StoreInventoryItemResponse.from(item, today, todaysCounts.get(item.getId())))
            .toList();
    }

    private StoreInventoryItemResponse toResponse(StoreInventoryItem item) {
        LocalDate today = LocalDate.now();
        Integer currentAvailable = item.getId() == null
            ? null
            : stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(item.getId(), today)
                .map(StockCheck::getCurrentCount)
                .orElse(null);
        return StoreInventoryItemResponse.from(item, today, currentAvailable);
    }

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
        item.setName(request.name().trim());
        item.setCategory(request.category());
        item.setUnitOfMeasurement(request.unitOfMeasurement().trim());
        item.setMinWeekday(request.minWeekday());
        item.setMinWeekend(request.minWeekend());
        item.setNote(request.note() != null ? request.note().trim() : null);
        item.setAutoPoEnabled(request.autoPoEnabled());

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
