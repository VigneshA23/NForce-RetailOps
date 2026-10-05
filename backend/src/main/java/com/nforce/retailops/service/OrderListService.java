package com.nforce.retailops.service;

import com.nforce.retailops.dto.CreateOrderListEntryRequest;
import com.nforce.retailops.dto.OrderListEntryResponse;
import com.nforce.retailops.dto.UpdateOrderListEntryRequest;
import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.OrderStatus;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidOrderListEntryException;
import com.nforce.retailops.exception.OrderListEntryNotFoundException;
import com.nforce.retailops.exception.StoreInventoryItemNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.exception.SupplierNotFoundException;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.SupplierRepository;
import com.nforce.retailops.repository.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

// Owner/Admin's Order Dashboard, plus the shared "raise or bump a shortage"
// logic used by both the stock-check auto-detection path and the employee
// ad-hoc report path.
@Service
public class OrderListService {

    private final OrderListEntryRepository orderListEntryRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final SupplierRepository supplierRepository;
    private final StoreInventoryItemRepository storeInventoryItemRepository;
    private final UserRepository userRepository;

    public OrderListService(
        OrderListEntryRepository orderListEntryRepository,
        StoreOwnerRepository storeOwnerRepository,
        SupplierRepository supplierRepository,
        StoreInventoryItemRepository storeInventoryItemRepository,
        UserRepository userRepository
    ) {
        this.orderListEntryRepository = orderListEntryRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.supplierRepository = supplierRepository;
        this.storeInventoryItemRepository = storeInventoryItemRepository;
        this.userRepository = userRepository;
    }

    // Picks the caller's active store the same multi-store-safe way
    // CategoryService.ownerStoreIds does, rather than findByOwnerIdAndActiveTrue
    // (a single Optional that throws for an owner with more than one active
    // store link).
    private StoreOwner requireActiveStoreOwner(Long ownerId) {
        return storeOwnerRepository.findByOwnerId(ownerId).stream()
            .filter(StoreOwner::isActive)
            .findFirst()
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
    }

    @Transactional(readOnly = true)
    public List<OrderListEntryResponse> listForOwner(Long ownerId) {
        StoreOwner storeOwner = requireActiveStoreOwner(ownerId);
        return orderListEntryRepository.findByStoreIdOrderByCreatedAtDesc(storeOwner.getStore().getId()).stream()
            .map(OrderListEntryResponse::from)
            .toList();
    }

    // Feeds the owner's Home low-stock tile. Response shape deliberately matches
    // NotificationService.unreadCount ({"count": n}) -- both back a numeric badge
    // and the frontend unwraps them through the same one-liner.
    @Transactional(readOnly = true)
    public Map<String, Long> needsOrderingCount(Long ownerId) {
        StoreOwner storeOwner = requireActiveStoreOwner(ownerId);
        return Map.of("count", orderListEntryRepository.countByStoreIdAndStatus(
            storeOwner.getStore().getId(), OrderStatus.NEEDS_ORDERING));
    }

    @Transactional
    public OrderListEntryResponse updateEntry(Long ownerId, Long entryId, UpdateOrderListEntryRequest request) {
        StoreOwner storeOwner = requireActiveStoreOwner(ownerId);

        OrderListEntry entry = orderListEntryRepository.findByIdAndStoreId(entryId, storeOwner.getStore().getId())
            .orElseThrow(() -> new OrderListEntryNotFoundException("Order list entry not found"));

        entry.setQuantityNeeded(request.quantityNeeded());
        entry.setNote(request.note());
        entry.setStatus(request.status());

        if (request.supplierId() == null) {
            entry.setSupplier(null);
        } else {
            Supplier supplier = supplierRepository.findById(request.supplierId())
                .orElseThrow(() -> new SupplierNotFoundException("Supplier not found"));
            entry.setSupplier(supplier);
        }

        entry = orderListEntryRepository.save(entry);
        return OrderListEntryResponse.from(entry);
    }

    // Owner/Admin manually adding to the order list ("Add to order"), as
    // opposed to a stock check auto-detecting a shortage. Reuses the same
    // upsertShortage path a detected shortage takes (including its V49/V70
    // unique-index race handling) rather than inserting directly -- so if
    // the item already has an active entry, this bumps its quantity/note
    // instead of risking a duplicate. One trade-off of that reuse: a
    // supplier chosen here only applies when creating a fresh entry, not
    // when bumping an existing one (upsertShortage never reassigns supplier
    // on an existing row) -- acceptable since this is the rare manual path,
    // not the common case.
    @Transactional
    public OrderListEntryResponse createEntry(Long ownerId, CreateOrderListEntryRequest request) {
        StoreOwner storeOwner = requireActiveStoreOwner(ownerId);
        Store store = storeOwner.getStore();
        User raisedBy = userRepository.getReferenceById(ownerId);

        Supplier supplier = null;
        if (request.supplierId() != null) {
            supplier = supplierRepository.findById(request.supplierId())
                .orElseThrow(() -> new SupplierNotFoundException("Supplier not found"));
        }

        StoreInventoryItem item = resolveOrderItem(store, request, supplier);
        Supplier defaultSupplier = supplier != null ? supplier : item.getPreferredSupplier();
        upsertShortage(store, item, request.quantityNeeded(), request.note(), true, raisedBy, defaultSupplier);

        OrderListEntry entry = orderListEntryRepository
            .findByStoreIdAndStoreInventoryItemIdAndStatusNot(store.getId(), item.getId(), OrderStatus.RECEIVED)
            .orElseThrow(() -> new OrderListEntryNotFoundException("Order list entry not found"));
        return OrderListEntryResponse.from(entry);
    }

    // Either an existing catalog item (storeInventoryItemId set) or a
    // freshly-created one for a custom one-off ("Other item"). The custom
    // item is saved active only when the caller asked to also keep it in
    // the store's inventory -- otherwise it's created inactive, existing
    // purely to satisfy order_list_entries.store_inventory_item_id (nullable
    // = false) without showing up in the Inventory page or daily counts.
    private StoreInventoryItem resolveOrderItem(Store store, CreateOrderListEntryRequest request, Supplier supplier) {
        if (request.storeInventoryItemId() != null) {
            return storeInventoryItemRepository.findByIdAndStoreId(request.storeInventoryItemId(), store.getId())
                .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));
        }

        if (request.itemName() == null || request.itemName().isBlank()) {
            throw new InvalidOrderListEntryException("Item name is required for a custom item");
        }
        if (request.unitOfMeasurement() == null || request.unitOfMeasurement().isBlank()) {
            throw new InvalidOrderListEntryException("Unit is required for a custom item");
        }
        if (request.category() == null) {
            throw new InvalidOrderListEntryException("Category is required for a custom item");
        }

        StoreInventoryItem item = new StoreInventoryItem();
        item.setStore(store);
        item.setName(request.itemName().trim());
        item.setCategory(request.category());
        item.setUnitOfMeasurement(request.unitOfMeasurement().trim());
        item.setMinWeekday(0);
        item.setPreferredSupplier(supplier);
        item.setActive(request.saveToInventory());
        return storeInventoryItemRepository.save(item);
    }

    // Shared upsert: raises a new shortage or bumps the quantity/note on an
    // already-active entry for the same store+item, rather than creating a
    // duplicate row. The V49 partial unique index
    // (store_id, inventory_item_id) WHERE status <> 'RECEIVED' is the
    // concurrency backstop -- on the rare race where two upserts for the same
    // store+item both miss the find step, the losing insert's constraint
    // violation is caught here and retried as an update against the winner's
    // row instead of surfacing as a raw 500.
    @Transactional
    public void upsertShortage(Store store, StoreInventoryItem item, int quantityNeeded, String note, boolean adHoc, User raisedBy, Supplier defaultSupplier) {
        try {
            doUpsertShortage(store, item, quantityNeeded, note, adHoc, raisedBy, defaultSupplier);
        } catch (DataIntegrityViolationException raceLostInsert) {
            doUpsertShortage(store, item, quantityNeeded, note, adHoc, raisedBy, defaultSupplier);
        }
    }

    private void doUpsertShortage(Store store, StoreInventoryItem item, int quantityNeeded, String note, boolean adHoc, User raisedBy, Supplier defaultSupplier) {
        OrderListEntry entry = orderListEntryRepository
            .findByStoreIdAndStoreInventoryItemIdAndStatusNot(store.getId(), item.getId(), OrderStatus.RECEIVED)
            .orElseGet(() -> {
                OrderListEntry created = new OrderListEntry();
                created.setStore(store);
                created.setStoreInventoryItem(item);
                created.setSupplier(defaultSupplier);
                created.setStatus(OrderStatus.NEEDS_ORDERING);
                return created;
            });

        entry.setQuantityNeeded(quantityNeeded);
        entry.setAdHoc(entry.getId() == null ? adHoc : entry.isAdHoc());
        if (note != null) {
            entry.setNote(note);
        }
        if (entry.getRaisedBy() == null) {
            entry.setRaisedBy(raisedBy);
        }
        orderListEntryRepository.save(entry);
    }

    // The other half of the shortage lifecycle: called whenever a fresh count
    // shows the item back at or above its minimum (quantityNeeded == 0). Never
    // creates a row -- only closes out an already-active one, the same way
    // Owner/Admin's own "Mark Received" action does, so the order-list side
    // stays consistent whichever path resolved it. History is untouched: the
    // row survives, it just leaves the active (non-RECEIVED) set, which is
    // exactly what frees the V49/V70 partial unique index for the next
    // shortage on this item.
    @Transactional
    public void resolveShortageIfPresent(Store store, StoreInventoryItem item) {
        orderListEntryRepository
            .findByStoreIdAndStoreInventoryItemIdAndStatusNot(store.getId(), item.getId(), OrderStatus.RECEIVED)
            .ifPresent(entry -> {
                entry.setStatus(OrderStatus.RECEIVED);
                orderListEntryRepository.save(entry);
            });
    }
}
