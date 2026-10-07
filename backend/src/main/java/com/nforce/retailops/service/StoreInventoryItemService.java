package com.nforce.retailops.service;

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
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SupplierRepository;
import com.nforce.retailops.util.InventoryCountStatusCalculator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Base64;
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
    private final InventoryItemImageRepository inventoryItemImageRepository;
    private final UnsplashService unsplashService;

    public StoreInventoryItemService(
        StoreInventoryItemRepository storeInventoryItemRepository,
        SupplierRepository supplierRepository,
        StoreRepository storeRepository,
        StoreOwnerRepository storeOwnerRepository,
        StockCheckRepository stockCheckRepository,
        OrderListEntryRepository orderListEntryRepository,
        InventoryItemImageRepository inventoryItemImageRepository,
        UnsplashService unsplashService
    ) {
        this.storeInventoryItemRepository = storeInventoryItemRepository;
        this.supplierRepository = supplierRepository;
        this.storeRepository = storeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.stockCheckRepository = stockCheckRepository;
        this.orderListEntryRepository = orderListEntryRepository;
        this.inventoryItemImageRepository = inventoryItemImageRepository;
        this.unsplashService = unsplashService;
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
        return storeInventoryItemRepository.save(item);
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
        item.setName(request.name().trim());
        item.setCategory(request.category());
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

        applyImage(item, request);
    }

    // Swaps in a newly picked Unsplash photo (downloaded now and stored as a
    // new image row) or removes the current one. The replaced row is deleted
    // rather than orphaned; Hibernate flushes that delete after the item's
    // update, so the FK never points at a missing row.
    private void applyImage(StoreInventoryItem item, StoreInventoryItemRequest request) {
        String photoId = request.imagePhotoId() != null ? request.imagePhotoId().trim() : "";
        String uploadData = request.imageUploadData() != null ? request.imageUploadData().trim() : "";
        boolean remove = Boolean.TRUE.equals(request.removeImage());
        if (photoId.isEmpty() && uploadData.isEmpty() && !remove) {
            return;
        }

        InventoryItemImage previous = item.getImage();
        if (!uploadData.isEmpty()) {
            item.setImage(inventoryItemImageRepository.save(uploadedImage(uploadData)));
        } else if (photoId.isEmpty()) {
            item.setImage(null);
        } else {
            UnsplashService.DownloadedPhoto photo = unsplashService.download(photoId);
            InventoryItemImage image = new InventoryItemImage();
            image.setContentType(photo.contentType());
            image.setData(photo.data());
            image.setUnsplashPhotoId(photo.photoId());
            image.setPhotographerName(photo.photographerName());
            image.setPhotographerUrl(photo.photographerUrl());
            item.setImage(inventoryItemImageRepository.save(image));
        }
        if (previous != null) {
            inventoryItemImageRepository.delete(previous);
        }
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
