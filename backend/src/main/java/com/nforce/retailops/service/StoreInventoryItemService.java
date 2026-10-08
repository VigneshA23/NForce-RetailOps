package com.nforce.retailops.service;

import com.nforce.retailops.dto.CreateStoreInventoryItemsResponse;
import com.nforce.retailops.dto.StockLevelComparisonRowResponse;
import com.nforce.retailops.dto.StoreInventoryItemRequest;
import com.nforce.retailops.dto.StoreInventoryItemResponse;
import com.nforce.retailops.entity.InventoryItemImage;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.exception.InvalidImageUploadException;
import com.nforce.retailops.exception.StoreInventoryItemHasHistoryException;
import com.nforce.retailops.exception.StoreInventoryItemNameExistsException;
import com.nforce.retailops.exception.StoreInventoryItemNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.exception.SupplierNotFoundException;
import com.nforce.retailops.repository.InventoryItemImageRepository;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SupplierRepository;
import com.nforce.retailops.util.InventoryCountStatusCalculator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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
    private final InventoryItemImageRepository inventoryItemImageRepository;
    private final UnsplashService unsplashService;
    private final StoreEmployeeRepository storeEmployeeRepository;
    private final NotificationService notificationService;

    public StoreInventoryItemService(
        StoreInventoryItemRepository storeInventoryItemRepository,
        SupplierRepository supplierRepository,
        StoreRepository storeRepository,
        StoreOwnerRepository storeOwnerRepository,
        StockCheckRepository stockCheckRepository,
        OrderListEntryRepository orderListEntryRepository,
        InventoryItemImageRepository inventoryItemImageRepository,
        UnsplashService unsplashService,
        StoreEmployeeRepository storeEmployeeRepository,
        NotificationService notificationService
    ) {
        this.storeInventoryItemRepository = storeInventoryItemRepository;
        this.supplierRepository = supplierRepository;
        this.storeRepository = storeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.stockCheckRepository = stockCheckRepository;
        this.orderListEntryRepository = orderListEntryRepository;
        this.inventoryItemImageRepository = inventoryItemImageRepository;
        this.unsplashService = unsplashService;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.notificationService = notificationService;
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
        return toResponse(applyActive(item, active));
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

    // Creates one copy of the item per selected store, all sharing an
    // itemGroupId. A store that already has an item with this name AND
    // category is skipped (reported back); one that has the name under a
    // different category is a genuine clash, so nothing is created and the
    // message names those stores.
    @Transactional
    public CreateStoreInventoryItemsResponse createForSuperAdmin(StoreInventoryItemRequest request) {
        Set<Long> ids = new LinkedHashSet<>();
        if (request.storeIds() != null && !request.storeIds().isEmpty()) {
            ids.addAll(request.storeIds());
        } else if (request.storeId() != null) {
            ids.add(request.storeId());
        }
        if (ids.isEmpty()) {
            throw new StoreNotFoundException("Select at least one store");
        }
        List<Store> stores = new ArrayList<>();
        for (Long id : ids) {
            stores.add(storeRepository.findById(id)
                .orElseThrow(() -> new StoreNotFoundException("Store not found")));
        }

        String name = request.name().trim();
        String category = request.category().trim();
        Map<Long, StoreInventoryItem> sameName = storeInventoryItemRepository.findByNameIgnoreCase(name).stream()
            .filter(i -> ids.contains(i.getStore().getId()))
            .collect(Collectors.toMap(i -> i.getStore().getId(), i -> i, (a, b) -> a));
        List<String> clashing = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<Store> toCreate = new ArrayList<>();
        for (Store store : stores) {
            StoreInventoryItem existing = sameName.get(store.getId());
            if (existing == null) {
                toCreate.add(store);
            } else if (existing.getCategory() != null && existing.getCategory().trim().equalsIgnoreCase(category)) {
                skipped.add(store.getName());
            } else {
                clashing.add(store.getName());
            }
        }
        if (!clashing.isEmpty()) {
            throw new StoreInventoryItemNameExistsException(
                "An inventory item named \"" + name + "\" already exists in a different category in: "
                    + String.join(", ", clashing) + ".");
        }
        if (toCreate.isEmpty()) {
            return new CreateStoreInventoryItemsResponse(List.of(), skipped);
        }

        // Each store's item owns its own image row (it is deleted with the
        // item), so the picture is fetched once and copied per store.
        InventoryItemImage template = newImage(request);
        UUID groupId = UUID.randomUUID();
        List<StoreInventoryItem> created = new ArrayList<>();
        for (Store store : toCreate) {
            StoreInventoryItem item = new StoreInventoryItem();
            item.setStore(store);
            item.setItemGroupId(groupId);
            applyFields(item, request, false);
            if (template != null) {
                item.setImage(inventoryItemImageRepository.save(copyOf(template)));
            }
            StoreInventoryItem saved = storeInventoryItemRepository.save(item);
            notifyEmployeesOfNewItem(store, saved);
            created.add(saved);
        }
        return new CreateStoreInventoryItemsResponse(toResponses(created), skipped);
    }

    // Categories used by items in every one of the given stores (case-
    // insensitive), for the Super Admin create form. With one store that is
    // simply the store's own categories.
    @Transactional(readOnly = true)
    public List<String> commonCategories(List<Long> storeIds) {
        Set<Long> ids = new LinkedHashSet<>(storeIds == null ? List.<Long>of() : storeIds);
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Long, Map<String, String>> byStore = new LinkedHashMap<>();
        for (Long id : ids) {
            byStore.put(id, new LinkedHashMap<>());
        }
        for (Object[] row : storeInventoryItemRepository.findStoreCategories(ids)) {
            String category = ((String) row[1]).trim();
            if (!category.isEmpty()) {
                byStore.get((Long) row[0]).putIfAbsent(category.toLowerCase(), category);
            }
        }
        Map<String, String> common = null;
        for (Map<String, String> categories : byStore.values()) {
            if (common == null) {
                common = new LinkedHashMap<>(categories);
            } else {
                common.keySet().retainAll(categories.keySet());
            }
        }
        return common.values().stream().sorted(String.CASE_INSENSITIVE_ORDER).toList();
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
        return toResponse(applyActive(item, active));
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
        checkNameAvailable(store.getId(), request.name().trim(), null);
        StoreInventoryItem item = new StoreInventoryItem();
        item.setStore(store);
        applyFields(item, request);
        StoreInventoryItem saved = storeInventoryItemRepository.save(item);
        notifyEmployeesOfNewItem(store, saved);
        return saved;
    }

    // Every employee assigned to the store is told the new item is on today's
    // stock check, since each item takes one Start of Day snapshot per day.
    private void notifyEmployeesOfNewItem(Store store, StoreInventoryItem item) {
        if (!item.isActive()) {
            return;
        }
        String itemName = item.getName();
        storeEmployeeRepository.findDistinctByStoresIdInOrderByIdAscFetchEmployee(Set.of(store.getId()))
            .forEach(se -> notificationService.send(
                se.getEmployee(), "STOCK_ITEM_ADDED",
                "New stock item: " + itemName,
                "\"" + itemName + "\" has been added to your store's stock check. Please complete its "
                    + "Start of Day check - only one response is allowed per item.",
                "/stock-check"));
    }

    // Only a real inactive -> active flip notifies, so re-sending "activate"
    // on an already-active item stays silent.
    private StoreInventoryItem applyActive(StoreInventoryItem item, boolean active) {
        boolean reactivated = active && !item.isActive();
        item.setActive(active);
        StoreInventoryItem saved = storeInventoryItemRepository.save(item);
        if (reactivated) {
            notifyEmployeesOfReactivatedItem(saved.getStore(), saved);
        }
        return saved;
    }

    private void notifyEmployeesOfReactivatedItem(Store store, StoreInventoryItem item) {
        String itemName = item.getName();
        storeEmployeeRepository.findDistinctByStoresIdInOrderByIdAscFetchEmployee(Set.of(store.getId()))
            .forEach(se -> notificationService.send(
                se.getEmployee(), "STOCK_ITEM_REACTIVATED",
                "Stock item reactivated: " + itemName,
                "\"" + itemName + "\" is back on your store's stock check. Please complete its "
                    + "Start of Day check - only one response is allowed per item.",
                "/stock-check"));
    }

    private StoreInventoryItem applyUpdate(StoreInventoryItem item, StoreInventoryItemRequest request) {
        checkNameAvailable(item.getStore().getId(), request.name().trim(), item.getId());
        applyFields(item, request);
        return storeInventoryItemRepository.save(item);
    }

    // Blocks a same-store, case-insensitive name collision regardless of the
    // other item's active state -- matches CategoryService.namesOverlapInStores,
    // which also doesn't free up a name just because the row holding it was
    // deactivated.
    private void checkNameAvailable(Long storeId, String name, Long excludeItemId) {
        boolean exists = excludeItemId == null
            ? storeInventoryItemRepository.existsByStoreIdAndNameIgnoreCase(storeId, name)
            : storeInventoryItemRepository.existsByStoreIdAndNameIgnoreCaseAndIdNot(storeId, name, excludeItemId);
        if (exists) {
            throw new StoreInventoryItemNameExistsException(
                "An inventory item with this name already exists for this store.");
        }
    }

    private void applyFields(StoreInventoryItem item, StoreInventoryItemRequest request) {
        applyFields(item, request, true);
    }

    private void applyFields(StoreInventoryItem item, StoreInventoryItemRequest request, boolean withImage) {
        item.setName(request.name().trim());
        item.setCategory(request.category().trim());
        item.setUnitOfMeasurement(request.unitOfMeasurement().trim());
        item.setMinWeekday(request.minWeekday());
        item.setMinWeekend(request.minWeekend());
        item.setNote(request.note() != null ? request.note().trim() : null);
        item.setAutoPoEnabled(request.autoPoEnabled());

        // preferredSupplierId is @NotNull on the request DTO, so this always
        // resolves to a real supplier by the time validation lets it through.
        Supplier supplier = supplierRepository.findById(request.preferredSupplierId())
            .orElseThrow(() -> new SupplierNotFoundException("Supplier not found"));
        item.setPreferredSupplier(supplier);

        if (withImage) {
            applyImage(item, request);
        }
    }

    // Swaps in a newly picked Unsplash photo (downloaded now and stored as a
    // new image row) or removes the current one. The replaced row is deleted
    // rather than orphaned; Hibernate flushes that delete after the item's
    // update, so the FK never points at a missing row.
    private void applyImage(StoreInventoryItem item, StoreInventoryItemRequest request) {
        boolean remove = Boolean.TRUE.equals(request.removeImage());
        InventoryItemImage fresh = newImage(request);
        if (fresh == null && !remove) {
            return;
        }

        InventoryItemImage previous = item.getImage();
        item.setImage(fresh == null ? null : inventoryItemImageRepository.save(fresh));
        if (previous != null) {
            inventoryItemImageRepository.delete(previous);
        }
    }

    // The new image a request asks for (an upload wins over an Unsplash id),
    // unsaved; null when the request carries neither.
    private InventoryItemImage newImage(StoreInventoryItemRequest request) {
        String photoId = request.imagePhotoId() != null ? request.imagePhotoId().trim() : "";
        String uploadData = request.imageUploadData() != null ? request.imageUploadData().trim() : "";
        if (!uploadData.isEmpty()) {
            return uploadedImage(uploadData);
        }
        if (photoId.isEmpty()) {
            return null;
        }
        UnsplashService.DownloadedPhoto photo = unsplashService.download(photoId);
        InventoryItemImage image = new InventoryItemImage();
        image.setContentType(photo.contentType());
        image.setData(photo.data());
        image.setUnsplashPhotoId(photo.photoId());
        image.setPhotographerName(photo.photographerName());
        image.setPhotographerUrl(photo.photographerUrl());
        return image;
    }

    private static InventoryItemImage copyOf(InventoryItemImage source) {
        InventoryItemImage copy = new InventoryItemImage();
        copy.setContentType(source.getContentType());
        copy.setData(source.getData());
        copy.setUnsplashPhotoId(source.getUnsplashPhotoId());
        copy.setPhotographerName(source.getPhotographerName());
        copy.setPhotographerUrl(source.getPhotographerUrl());
        return copy;
    }

    private static final int MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

    // Decodes a user-uploaded data URL. The content type comes from the
    // file's own magic bytes, not the client's claim, and only the formats
    // browsers render inline are accepted.
    private InventoryItemImage uploadedImage(String dataUrl) {
        int comma = dataUrl.indexOf(',');
        if (!dataUrl.startsWith("data:image/") || comma < 0 || !dataUrl.substring(0, comma).endsWith(";base64")) {
            throw new InvalidImageUploadException("Uploaded image is invalid");
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(dataUrl.substring(comma + 1));
        } catch (IllegalArgumentException e) {
            throw new InvalidImageUploadException("Uploaded image is invalid");
        }
        if (bytes.length > MAX_UPLOAD_BYTES) {
            throw new InvalidImageUploadException("Image must be 2 MB or smaller");
        }
        String contentType = sniffImageType(bytes);
        if (contentType == null) {
            throw new InvalidImageUploadException("Image must be a JPEG, PNG or WebP file");
        }
        InventoryItemImage image = new InventoryItemImage();
        image.setContentType(contentType);
        image.setData(bytes);
        return image;
    }

    private static String sniffImageType(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') {
            return "image/png";
        }
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
            && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return "image/webp";
        }
        return null;
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
        InventoryItemImage image = item.getImage();
        storeInventoryItemRepository.delete(item);
        if (image != null) {
            inventoryItemImageRepository.delete(image);
        }
    }
}
