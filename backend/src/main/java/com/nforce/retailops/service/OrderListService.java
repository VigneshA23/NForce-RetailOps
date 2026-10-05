package com.nforce.retailops.service;

import com.nforce.retailops.dto.OrderListEntryResponse;
import com.nforce.retailops.dto.UpdateOrderListEntryRequest;
import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.OrderStatus;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidOrderEntryTransitionException;
import com.nforce.retailops.exception.OrderListEntryNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.exception.SupplierNotFoundException;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.SupplierRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;

// Owner/Admin's Order Dashboard, plus the shared "raise or bump a shortage"
// logic used by both the stock-check auto-detection path and the employee
// ad-hoc report path.
@Service
public class OrderListService {

    // Owner/Admin's manual status edit (updateEntry below) must move forward
    // one step at a time -- Needs Ordering -> Ordered -> Received, never
    // skipped or reversed. This does NOT apply to resolveShortageIfPresent,
    // which auto-closes an entry straight to RECEIVED when a fresh count
    // shows the shortage is gone on its own (a different, system-driven
    // resolution path, not a manual edit).
    private static final Map<OrderStatus, Set<OrderStatus>> ALLOWED_TRANSITIONS = Map.of(
        OrderStatus.NEEDS_ORDERING, Set.of(OrderStatus.ORDERED),
        OrderStatus.ORDERED, Set.of(OrderStatus.RECEIVED),
        OrderStatus.RECEIVED, Set.of()
    );

    private final OrderListEntryRepository orderListEntryRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final SupplierRepository supplierRepository;

    public OrderListService(
        OrderListEntryRepository orderListEntryRepository,
        StoreOwnerRepository storeOwnerRepository,
        SupplierRepository supplierRepository
    ) {
        this.orderListEntryRepository = orderListEntryRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.supplierRepository = supplierRepository;
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

        OrderStatus currentStatus = entry.getStatus();
        OrderStatus targetStatus = request.status();
        if (currentStatus != targetStatus && !ALLOWED_TRANSITIONS.getOrDefault(currentStatus, Set.of()).contains(targetStatus)) {
            throw new InvalidOrderEntryTransitionException(
                "Cannot move this order from " + currentStatus + " to " + targetStatus
                    + ". Orders must go Needs Ordering → Ordered → Received, one step at a time.");
        }

        entry.setQuantityNeeded(request.quantityNeeded());
        entry.setNote(request.note());
        entry.setStatus(targetStatus);

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
