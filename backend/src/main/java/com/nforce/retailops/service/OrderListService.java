package com.nforce.retailops.service;

import com.nforce.retailops.dto.CreateOrderListEntryRequest;
import com.nforce.retailops.dto.OrderListEntryResponse;
import com.nforce.retailops.dto.SupplierPurchaseMetricResponse;
import com.nforce.retailops.dto.UpdateOrderListEntryRequest;
import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.OrderStatus;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidOrderEntryTransitionException;
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
import com.nforce.retailops.util.DateRangeValidator;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Comparator;
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

    static final String NO_SUPPLIER = "No Supplier";

    // Matches ChecklistHistoryService/StockCheckService's own cap for a
    // bounded from/to report range.
    private static final int MAX_DATE_RANGE_DAYS = 92;

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

    // Super Admin's cross-store order-list drill-down (SuperAdminOperationsService).
    // No store-existence check -- a bad/non-existent storeId simply yields an
    // empty list, a reasonable response for a list endpoint rather than a 404.
    @Transactional(readOnly = true)
    public List<OrderListEntryResponse> listForStore(Long storeId) {
        return orderListEntryRepository.findByStoreIdOrderByCreatedAtDesc(storeId).stream()
            .map(OrderListEntryResponse::from)
            .toList();
    }

    // Super Admin's status-only edit, counterpart to updateEntry above but store-id
    // based (a Super Admin has no StoreOwner link to resolve a store from). Reuses
    // the same ALLOWED_TRANSITIONS one-step-at-a-time rule and the existing
    // findByIdAndStoreId lookup, so a cross-store entryId 404s exactly like it
    // already does for Owner/Admin.
    @Transactional
    public OrderListEntryResponse updateStatusForSuperAdmin(Long storeId, Long entryId, OrderStatus targetStatus) {
        OrderListEntry entry = orderListEntryRepository.findByIdAndStoreId(entryId, storeId)
            .orElseThrow(() -> new OrderListEntryNotFoundException("Order list entry not found"));

        OrderStatus currentStatus = entry.getStatus();
        if (currentStatus != targetStatus && !ALLOWED_TRANSITIONS.getOrDefault(currentStatus, Set.of()).contains(targetStatus)) {
            throw new InvalidOrderEntryTransitionException(
                "Cannot move this order from " + currentStatus + " to " + targetStatus
                    + ". Orders must go Needs Ordering → Ordered → Received, one step at a time.");
        }

        entry.setStatus(targetStatus);
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

        boolean isNewEntry = entry.getId() == null;

        // A manual "Add to order" (adHoc) on an item that already has an
        // active entry tops it up rather than replacing it -- quantityNeeded
        // stays whatever the stock count last calculated, and the typed
        // amount accumulates in manualAddition instead (Order List shows the
        // two separately; the real quantity to order is their sum). Every
        // other case -- a system stock-check recalculation, or a brand-new
        // entry of either kind -- treats quantityNeeded as the fresh
        // baseline and clears any manual top-up, since that top-up was for
        // the figure being replaced, not a running total.
        if (adHoc && !isNewEntry) {
            entry.setManualAddition(entry.getManualAddition() + quantityNeeded);
        } else {
            entry.setQuantityNeeded(quantityNeeded);
            entry.setManualAddition(0);
        }

        entry.setAdHoc(isNewEntry ? adHoc : entry.isAdHoc());
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

    // Owner/Admin's Supplier Purchasing Summary: the store always comes from
    // the caller's own StoreOwner link (requireActiveStoreOwner), never from a
    // client-supplied store ID, so another store's data can never be reached
    // this way. Aggregation (COUNT/SUM/GROUP BY) happens entirely in
    // findSupplierMetricsForStore -- this method only validates the range and
    // maps the resulting tuples.
    @Transactional(readOnly = true)
    public List<SupplierPurchaseMetricResponse> getSupplierMetricsForOwner(Long ownerId, LocalDate fromDate, LocalDate toDate) {
        DateRangeValidator.validate(fromDate, toDate, MAX_DATE_RANGE_DAYS);
        StoreOwner storeOwner = requireActiveStoreOwner(ownerId);

        List<Object[]> rows = orderListEntryRepository.findSupplierMetricsForStore(
            storeOwner.getStore().getId(), OrderStatus.PURCHASED_STATUSES, rangeStart(fromDate), rangeEndExclusive(toDate));

        return rows.stream()
            .map(row -> new SupplierPurchaseMetricResponse(
                row[1] != null ? (String) row[1] : NO_SUPPLIER,
                ((Number) row[2]).longValue(),
                ((Number) row[3]).longValue()
            ))
            .sorted(Comparator.comparing(SupplierPurchaseMetricResponse::supplierName, String.CASE_INSENSITIVE_ORDER))
            .toList();
    }

    // Same half-open-interval convention as ActivityLogService.rangeStart/
    // rangeEndExclusive: [start of fromDate, start of the day after toDate),
    // in the server's local zone -- so the range is inclusive of both the
    // selected From and To calendar days.
    static OffsetDateTime rangeStart(LocalDate date) {
        return date.atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
    }

    static OffsetDateTime rangeEndExclusive(LocalDate date) {
        return date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
    }
}
