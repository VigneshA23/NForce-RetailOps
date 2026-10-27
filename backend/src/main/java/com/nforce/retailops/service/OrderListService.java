package com.nforce.retailops.service;

import com.nforce.retailops.dto.CreateOrderListEntryRequest;
import com.nforce.retailops.dto.OrderHistoryEntryResponse;
import com.nforce.retailops.dto.OrderHistoryPageResponse;
import com.nforce.retailops.dto.OrderListEntryResponse;
import com.nforce.retailops.dto.SupplierPurchaseMetricResponse;
import com.nforce.retailops.dto.UpdateOrderListEntryRequest;
import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.OrderStatus;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidOrderEntryTransitionException;
import com.nforce.retailops.exception.InvalidOrderListEntryException;
import com.nforce.retailops.exception.OrderEntryAlreadyUpdatedException;
import com.nforce.retailops.exception.OrderListEntryNotFoundException;
import com.nforce.retailops.exception.StoreInventoryItemNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.exception.SupplierNotFoundException;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SupplierRepository;
import com.nforce.retailops.repository.UserRepository;
import com.nforce.retailops.util.DateRangeValidator;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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

    private static final String ROLE_OWNER_ADMIN = "OWNER_ADMIN";
    private static final String ROLE_SUPER_ADMIN = "SUPER_ADMIN";

    // Both roles can edit the same entry, so a caller acting on a stale view
    // (it loaded the entry as expectedStatus, but someone has since moved it)
    // must be told rather than silently overwriting -- or, for a same-status
    // re-save, silently "succeeding" on a change that's already been made.
    // expectedStatus == null means an older client that doesn't send it: no check.
    private static void rejectIfStale(OrderListEntry entry, OrderStatus expectedStatus) {
        if (expectedStatus == null || entry.getStatus() == expectedStatus) {
            return;
        }
        String by = ROLE_SUPER_ADMIN.equals(entry.getStatusChangedByRole()) ? " by Super Admin"
            : ROLE_OWNER_ADMIN.equals(entry.getStatusChangedByRole()) ? " by Admin"
            : "";
        throw new OrderEntryAlreadyUpdatedException(
            "This item has already been updated" + by + ". It is now marked as "
                + statusLabel(entry.getStatus()) + ". The list has been refreshed.");
    }

    private static String statusLabel(OrderStatus status) {
        return switch (status) {
            case NEEDS_ORDERING -> "Needs ordering";
            case ORDERED -> "Ordered";
            case RECEIVED -> "Received";
        };
    }

    // Matches ChecklistHistoryService/StockCheckService's own cap for a
    // bounded from/to report range.
    private static final int MAX_DATE_RANGE_DAYS = 92;

    private final OrderListEntryRepository orderListEntryRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreRepository storeRepository;
    private final SupplierRepository supplierRepository;
    private final StoreInventoryItemRepository storeInventoryItemRepository;
    private final UserRepository userRepository;
    private final StockReceiptService stockReceiptService;
    private final StockCheckRepository stockCheckRepository;

    public OrderListService(
        OrderListEntryRepository orderListEntryRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreRepository storeRepository,
        SupplierRepository supplierRepository,
        StoreInventoryItemRepository storeInventoryItemRepository,
        UserRepository userRepository,
        StockReceiptService stockReceiptService,
        StockCheckRepository stockCheckRepository
    ) {
        this.stockCheckRepository = stockCheckRepository;
        this.orderListEntryRepository = orderListEntryRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeRepository = storeRepository;
        this.supplierRepository = supplierRepository;
        this.storeInventoryItemRepository = storeInventoryItemRepository;
        this.userRepository = userRepository;
        this.stockReceiptService = stockReceiptService;
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
        rejectIfStale(entry, request.expectedStatus());
        if (currentStatus != targetStatus && !ALLOWED_TRANSITIONS.getOrDefault(currentStatus, Set.of()).contains(targetStatus)) {
            throw new InvalidOrderEntryTransitionException(
                "Cannot move this order from " + currentStatus + " to " + targetStatus
                    + ". Orders must go Needs Ordering → Ordered → Received, one step at a time.");
        }

        if (currentStatus != targetStatus) {
            entry.setStatusChangedByRole(ROLE_OWNER_ADMIN);
        }
        // Only resolved when actually needed for a stamp below -- a plain edit
        // (no status change) never touches the user repository at all, same as
        // before this entry gained ordered/received attribution.
        boolean movingToOrdered = targetStatus == OrderStatus.ORDERED && currentStatus != OrderStatus.ORDERED;
        boolean receivedNow = currentStatus == OrderStatus.ORDERED && targetStatus == OrderStatus.RECEIVED;
        User owner = movingToOrdered || receivedNow ? userRepository.getReferenceById(ownerId) : null;

        if (movingToOrdered) {
            stampOrderedAt(entry, currentStatus, targetStatus, owner.getFullName());
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

        if (receivedNow) {
            entry.setQuantityReceived(request.quantityReceived() != null
                ? request.quantityReceived()
                : entry.totalQuantityOrdered());
            stampReceived(entry, owner.getFullName());
        }

        entry = orderListEntryRepository.save(entry);
        if (receivedNow) {
            closeAlsoReceived(entry, request.alsoReceivedEntryIds(), owner.getFullName());
            return OrderListEntryResponse.from(entry, applyReceivedStock(entry, owner, null));
        }
        return OrderListEntryResponse.from(entry);
    }

    // The permanent record of "received on this day, by this person" --
    // written only where a real delivery is being confirmed, never by
    // resolveShortageIfPresent's auto-withdrawal (which leaves both null).
    private static void stampReceived(OrderListEntry entry, String receivedByName) {
        entry.setReceivedAt(OffsetDateTime.now());
        entry.setReceivedByName(receivedByName);
    }

    // "Both orders received": the lead entry's receipt already covers these, so
    // they are only closed (stock is not updated again). Each must be an
    // Ordered row for the same item in the same store. Also a real delivery
    // from the receiving person's point of view, so it gets the same
    // quantityReceived/receivedAt/receivedByName stamp as the lead entry --
    // otherwise a co-received row stayed RECEIVED with no quantity or receipt
    // time at all.
    private void closeAlsoReceived(OrderListEntry lead, List<Long> alsoReceivedIds, String receivedByName) {
        if (alsoReceivedIds == null) {
            return;
        }
        for (Long id : alsoReceivedIds.stream().distinct().toList()) {
            OrderListEntry other = orderListEntryRepository.findByIdAndStoreId(id, lead.getStore().getId())
                .orElseThrow(() -> new OrderListEntryNotFoundException("Order list entry not found"));
            if (other.getId().equals(lead.getId())
                || !other.getStoreInventoryItem().getId().equals(lead.getStoreInventoryItem().getId())
                || other.getStatus() != OrderStatus.ORDERED) {
                throw new InvalidOrderEntryTransitionException(
                    "Only other Ordered orders for the same item can be received together.");
            }
            other.setStatus(OrderStatus.RECEIVED);
            other.setStatusChangedByRole(ROLE_OWNER_ADMIN);
            other.setQuantityReceived(other.totalQuantityOrdered());
            stampReceived(other, receivedByName);
            orderListEntryRepository.save(other);
        }
    }

    // The permanent record of "ordered on this day, by this person", written
    // by every path that moves an entry to Ordered (Order List page, EOD
    // report, Super Admin).
    private static void stampOrderedAt(OrderListEntry entry, OrderStatus from, OrderStatus to, String orderedByName) {
        if (to == OrderStatus.ORDERED && from != OrderStatus.ORDERED) {
            entry.setOrderedAt(OffsetDateTime.now());
            entry.setOrderedByName(orderedByName);
        }
    }

    // What was ordered for an item, and when. quantity is needed + manual top-up.
    public record OrderedInfo(BigDecimal quantity, OffsetDateTime orderedAt) {
        public LocalDate orderedOn() {
            return orderedAt.atZoneSameInstant(ZoneId.systemDefault()).toLocalDate();
        }
    }

    // The EOD report's order history for one day, per item, including orders
    // since received. Normally the orders placed on that day itself. Two
    // widenings, because a shortage can be ordered after the day it's counted:
    //  - yesterday's window runs through today, so an item ordered this
    //    morning for yesterday's shortage shows as ordered (dated today);
    //  - today also includes anything still sitting at Ordered from earlier,
    //    since it's outstanding and hasn't been received yet.
    // Where an item has several, quantities are summed and the earliest order
    // date wins.
    @Transactional(readOnly = true)
    public Map<Long, OrderedInfo> orderedInfoByItemFor(Long storeId, LocalDate date) {
        LocalDate today = LocalDate.now();
        LocalDate lastDay = date.equals(today.minusDays(1)) ? today : date;
        List<OrderListEntry> entries = new java.util.ArrayList<>(orderListEntryRepository
            .findByStoreIdAndOrderedAtGreaterThanEqualAndOrderedAtLessThan(storeId, rangeStart(date), rangeEndExclusive(lastDay)));
        if (date.equals(today)) {
            orderListEntryRepository.findByStoreIdAndStatusNotOrderByCreatedAtDesc(storeId, OrderStatus.RECEIVED).stream()
                .filter(e -> e.getStatus() == OrderStatus.ORDERED && e.getOrderedAt() != null && e.getOrderedAt().isBefore(rangeStart(date)))
                .forEach(entries::add);
        }
        return entries.stream().collect(java.util.stream.Collectors.toMap(
            e -> e.getStoreInventoryItem().getId(),
            e -> new OrderedInfo(e.totalQuantityOrdered(), e.getOrderedAt()),
            (a, b) -> new OrderedInfo(
                a.quantity().add(b.quantity()),
                a.orderedAt().isBefore(b.orderedAt()) ? a.orderedAt() : b.orderedAt())
        ));
    }

    // Needs Ordering -> Ordered with nothing else changed, for the EOD report's
    // one editable status. Goes through updateEntry so the stale-view check,
    // transition rule and status-changed-by attribution are the same ones the
    // Order List page applies.
    @Transactional
    public OrderListEntryResponse markOrdered(Long ownerId, Long entryId) {
        StoreOwner storeOwner = requireActiveStoreOwner(ownerId);
        OrderListEntry entry = orderListEntryRepository.findByIdAndStoreId(entryId, storeOwner.getStore().getId())
            .orElseThrow(() -> new OrderListEntryNotFoundException("Order list entry not found"));
        // Once today's Start of Day is in (and End of Day isn't), a system row
        // is being reconciled against the latest stock, so the EOD report's
        // one-click "Ordered" on the earlier shortage no longer applies. The
        // reconciled row is ordered from the Order List page instead.
        boolean startOfDayInEndOfDayNot = !entry.isAdHoc()
            && stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(entry.getStoreInventoryItem().getId(), LocalDate.now())
                .filter(c -> c.hasSnapshot(StockCheckSnapshot.START_OF_DAY) && !c.hasSnapshot(StockCheckSnapshot.END_OF_DAY))
                .isPresent();
        if (startOfDayInEndOfDayNot) {
            throw new InvalidOrderEntryTransitionException(
                "Today's Start of Day count has been submitted, so this order was recalculated from the latest stock. "
                    + "Review it on the Order List page before marking it Ordered.");
        }
        return updateEntry(ownerId, entryId, new UpdateOrderListEntryRequest(
            entry.getQuantityNeeded(),
            entry.getSupplier() != null ? entry.getSupplier().getId() : null,
            entry.getNote(),
            OrderStatus.ORDERED,
            OrderStatus.NEEDS_ORDERING));
    }

    // The stock side of Ordered -> Received: adds what was actually received
    // to the item's current stock and reports where that leaves it against
    // today's minimum. Deliberately raises nothing: other rows for the item
    // may still be on their way, so a remaining shortfall is for the admin to
    // act on, not for the system to re-order.
    private OrderListEntryResponse.ReceiptOutcome applyReceivedStock(OrderListEntry entry, User user, SuperAdmin superAdmin) {
        StoreInventoryItem item = entry.getStoreInventoryItem();
        StockReceiptService.Result result = stockReceiptService.applyReceipt(item, entry.getQuantityReceived(), user, superAdmin);
        if (!result.stockUpdated()) {
            return new OrderListEntryResponse.ReceiptOutcome(false, null, result.requiredToday(), null);
        }

        BigDecimal shortfall = result.requiredToday() == null
            ? BigDecimal.ZERO
            : result.requiredToday().subtract(result.currentStock()).max(BigDecimal.ZERO);
        return new OrderListEntryResponse.ReceiptOutcome(true, result.currentStock(), result.requiredToday(), shortfall);
    }

    // The Ordered orders an employee may confirm as received, per item. Plain
    // reads of the order list for an employee-facing screen, so only what the
    // popup needs leaves the service.
    @Transactional(readOnly = true)
    public Map<Long, List<OrderListEntry>> orderedEntriesByItem(Long storeId) {
        return orderListEntryRepository.findByStoreIdAndStatusNotOrderByCreatedAtDesc(storeId, OrderStatus.RECEIVED).stream()
            .filter(e -> e.getStatus() == OrderStatus.ORDERED)
            .collect(java.util.stream.Collectors.groupingBy(e -> e.getStoreInventoryItem().getId()));
    }

    // Items whose system-raised (not ad hoc) order was marked Ordered on `date`.
    // Start of Day is locked for these: the order was placed from that count.
    @Transactional(readOnly = true)
    public java.util.Set<Long> itemIdsOrderedOn(Long storeId, LocalDate date) {
        return orderListEntryRepository
            .findByStoreIdAndOrderedAtGreaterThanEqualAndOrderedAtLessThan(storeId, rangeStart(date), rangeEndExclusive(date))
            .stream()
            .filter(e -> !e.isAdHoc())
            .map(e -> e.getStoreInventoryItem().getId())
            .collect(java.util.stream.Collectors.toSet());
    }

    // An Ordered order of this item in this store, or an error; what an employee
    // may name when reporting it received.
    @Transactional(readOnly = true)
    public OrderListEntry requireOrderedEntry(Long storeId, Long itemId, Long entryId) {
        OrderListEntry entry = orderListEntryRepository.findByIdAndStoreId(entryId, storeId)
            .orElseThrow(() -> new OrderListEntryNotFoundException("Order list entry not found"));
        if (!entry.getStoreInventoryItem().getId().equals(itemId) || entry.getStatus() != OrderStatus.ORDERED) {
            throw new InvalidOrderEntryTransitionException("Only an Ordered order for this item can be confirmed as received.");
        }
        return entry;
    }

    // The order side of an approved received-stock request: Ordered -> Received
    // with the quantity the employee reported. Stock itself is applied by the
    // approval (the employee's End of Day count already includes the delivery),
    // so this deliberately does not go through applyReceivedStock. receivedByName
    // is the approving Owner/Admin -- the one who confirmed the delivery really
    // happened, not the employee who reported it (that's already raisedBy/the
    // StockReceiptRequest's own requestedBy).
    @Transactional
    public void confirmReceivedByApproval(OrderListEntry entry, BigDecimal quantityReceived, String receivedByName) {
        if (entry.getStatus() != OrderStatus.ORDERED) {
            throw new InvalidOrderEntryTransitionException(
                "This order is no longer Ordered, so it cannot be confirmed as received. Reject this request instead.");
        }
        entry.setStatus(OrderStatus.RECEIVED);
        entry.setQuantityReceived(quantityReceived);
        entry.setStatusChangedByRole(ROLE_OWNER_ADMIN);
        stampReceived(entry, receivedByName);
        orderListEntryRepository.save(entry);
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
        return updateStatusForSuperAdmin(storeId, entryId, targetStatus, null);
    }

    @Transactional
    public OrderListEntryResponse updateStatusForSuperAdmin(Long storeId, Long entryId, OrderStatus targetStatus, OrderStatus expectedStatus) {
        return updateStatusForSuperAdmin(storeId, entryId, targetStatus, expectedStatus, null, null);
    }

    // superAdmin is who to attribute the stock change to when this marks the
    // order received; null (older callers) leaves stock untouched.
    @Transactional
    public OrderListEntryResponse updateStatusForSuperAdmin(
        Long storeId, Long entryId, OrderStatus targetStatus, OrderStatus expectedStatus,
        BigDecimal quantityReceived, SuperAdmin superAdmin
    ) {
        OrderListEntry entry = orderListEntryRepository.findByIdAndStoreId(entryId, storeId)
            .orElseThrow(() -> new OrderListEntryNotFoundException("Order list entry not found"));

        OrderStatus currentStatus = entry.getStatus();
        rejectIfStale(entry, expectedStatus);
        if (currentStatus != targetStatus && !ALLOWED_TRANSITIONS.getOrDefault(currentStatus, Set.of()).contains(targetStatus)) {
            throw new InvalidOrderEntryTransitionException(
                "Cannot move this order from " + currentStatus + " to " + targetStatus
                    + ". Orders must go Needs Ordering → Ordered → Received, one step at a time.");
        }

        if (currentStatus != targetStatus) {
            entry.setStatusChangedByRole(ROLE_SUPER_ADMIN);
        }
        String actorName = superAdmin != null ? superAdmin.getName() : "Super Admin";
        stampOrderedAt(entry, currentStatus, targetStatus, actorName);
        entry.setStatus(targetStatus);
        boolean receivedNow = currentStatus == OrderStatus.ORDERED && targetStatus == OrderStatus.RECEIVED;
        if (receivedNow) {
            entry.setQuantityReceived(quantityReceived != null ? quantityReceived : entry.totalQuantityOrdered());
            stampReceived(entry, actorName);
        }
        entry = orderListEntryRepository.save(entry);
        if (receivedNow) {
            return OrderListEntryResponse.from(entry, applyReceivedStock(entry, null, superAdmin));
        }
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
        User raisedBy = userRepository.getReferenceById(ownerId);
        return createEntryForStore(storeOwner.getStore(), raisedBy, request);
    }

    // Super Admin's counterpart to createEntry above -- store comes directly
    // from a path param rather than the caller's own StoreOwner link, since a
    // Super Admin has none. raisedBy is left null (OrderListEntry.raisedBy is
    // nullable): Super Admin has no row in `users` to reference, same reason
    // AdminCorrection/StockCheckCorrection carry a separate "no user row"
    // fallback for their own correctedBy fields.
    @Transactional
    public OrderListEntryResponse createEntryForSuperAdmin(Long storeId, CreateOrderListEntryRequest request) {
        Store store = storeRepository.findById(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        return createEntryForStore(store, null, request);
    }

    private OrderListEntryResponse createEntryForStore(Store store, User raisedBy, CreateOrderListEntryRequest request) {
        Supplier supplier = null;
        if (request.supplierId() != null) {
            supplier = supplierRepository.findById(request.supplierId())
                .orElseThrow(() -> new SupplierNotFoundException("Supplier not found"));
        }

        StoreInventoryItem item = resolveOrderItem(store, request, supplier);
        Supplier defaultSupplier = supplier != null ? supplier : item.getPreferredSupplier();
        OrderListEntry entry = upsertShortage(store, item, request.quantityNeeded(), request.note(), true, raisedBy, defaultSupplier);
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
        if (request.category() == null || request.category().isBlank()) {
            throw new InvalidOrderListEntryException("Category is required for a custom item");
        }

        StoreInventoryItem item = new StoreInventoryItem();
        item.setStore(store);
        item.setName(request.itemName().trim());
        item.setCategory(request.category().trim());
        item.setUnitOfMeasurement(request.unitOfMeasurement().trim());
        item.setMinWeekday(request.minWeekday() != null ? request.minWeekday() : BigDecimal.ZERO);
        item.setMinWeekend(request.minWeekend());
        item.setPreferredSupplier(supplier);
        item.setActive(request.saveToInventory());
        return storeInventoryItemRepository.save(item);
    }

    // Raises one order requirement. Every requirement is its own row, managed
    // independently by the admin (Needs Ordering -> Ordered -> Received); the
    // system never adds to a row's quantity or moves its status.
    //  - adHoc (manual "Add to order", employee shortage report): added to the
    //    Manual column of the item's Needs Ordering row; a new row only when
    //    none is waiting (e.g. the existing one is already Ordered).
    //  - system (stock count): updates the item's open system-raised Needs
    //    Ordering row in place so re-saving a count doesn't stack duplicates,
    //    else creates one. A row already Ordered is never touched -- a later
    //    count's shortage becomes a fresh row beside it.
    // The V94 partial unique index (one open system row per item) is the
    // concurrency backstop: the losing insert of a race is retried as an
    // update against the winner's row instead of surfacing as a raw 500.
    @Transactional
    public OrderListEntry upsertShortage(Store store, StoreInventoryItem item, BigDecimal quantityNeeded, String note, boolean adHoc, User raisedBy, Supplier defaultSupplier) {
        return upsertShortage(store, item, quantityNeeded, note, adHoc, false, raisedBy, defaultSupplier);
    }

    // urgent: the item is completely out of stock. A system (non-adHoc) upsert
    // sets the flag to exactly this value, so a fresh count that is no longer
    // zero clears it; a manual top-up never changes it.
    @Transactional
    public OrderListEntry upsertShortage(Store store, StoreInventoryItem item, BigDecimal quantityNeeded, String note, boolean adHoc, boolean urgent, User raisedBy, Supplier defaultSupplier) {
        return upsertShortage(store, item, quantityNeeded, note, adHoc, urgent, raisedBy, defaultSupplier, LocalDate.now());
    }

    // countDate: the day whose stock check the row's stock snapshot is taken
    // from. Today for a normal count; yesterday when a missed End of Day is
    // answered late.
    @Transactional
    public OrderListEntry upsertShortage(Store store, StoreInventoryItem item, BigDecimal quantityNeeded, String note, boolean adHoc, boolean urgent, User raisedBy, Supplier defaultSupplier, LocalDate countDate) {
        try {
            return doUpsertShortage(store, item, quantityNeeded, note, adHoc, urgent, raisedBy, defaultSupplier, countDate);
        } catch (DataIntegrityViolationException raceLostInsert) {
            return doUpsertShortage(store, item, quantityNeeded, note, adHoc, urgent, raisedBy, defaultSupplier, countDate);
        }
    }

    // Employee mid-day shortage report (RTS-368). requiredQuantity is the total
    // the employee says is needed; they cannot see the order list, so what is
    // already waiting (Needs Ordering) and, unless they confirm it has arrived,
    // what is already Ordered is netted off and only the remainder is added.
    // Returns null when the existing rows already cover the requirement.
    @Transactional
    public OrderListEntry upsertReportedShortage(Store store, StoreInventoryItem item, BigDecimal requiredQuantity, String note, User raisedBy, Supplier defaultSupplier, boolean orderedAlreadyReceived, boolean outOfStock) {
        BigDecimal covered = BigDecimal.ZERO;
        for (OrderListEntry existing : orderListEntryRepository
            .findByStoreIdAndStoreInventoryItemIdAndStatusOrderByCreatedAtAsc(store.getId(), item.getId(), OrderStatus.NEEDS_ORDERING)) {
            covered = covered.add(existing.totalQuantityOrdered());
        }
        if (!orderedAlreadyReceived) {
            for (OrderListEntry existing : orderListEntryRepository
                .findByStoreIdAndStoreInventoryItemIdAndStatusOrderByCreatedAtAsc(store.getId(), item.getId(), OrderStatus.ORDERED)) {
                covered = covered.add(existing.totalQuantityOrdered());
            }
        }
        BigDecimal remaining = requiredQuantity.subtract(covered);
        if (outOfStock) {
            return raiseReportedNeed(store, item, remaining.max(BigDecimal.ZERO), note, raisedBy, defaultSupplier, true);
        }
        if (remaining.signum() <= 0) {
            return null;
        }
        // The shortfall comes from the stock figure, not from the employee
        // typing a quantity, so it belongs in the Needs column, not Manual.
        return raiseReportedNeed(store, item, remaining, note, raisedBy, defaultSupplier, false);
    }

    // The rest of a reported requirement goes into the Needs column itself
    // (not Manual); out of stock also flags the row urgent. Works on
    // the row still waiting to be ordered; a new system row only when none is.
    private OrderListEntry raiseReportedNeed(Store store, StoreInventoryItem item, BigDecimal remaining, String note, User raisedBy, Supplier defaultSupplier, boolean urgent) {
        OrderListEntry entry = orderListEntryRepository
            .findByStoreIdAndStoreInventoryItemIdAndStatusOrderByCreatedAtAsc(store.getId(), item.getId(), OrderStatus.NEEDS_ORDERING)
            .stream().findFirst().orElse(null);
        if (entry == null) {
            if (remaining.signum() <= 0) {
                return null;
            }
            entry = new OrderListEntry();
            entry.setStore(store);
            entry.setStoreInventoryItem(item);
            entry.setSupplier(defaultSupplier);
            entry.setStatus(OrderStatus.NEEDS_ORDERING);
            entry.setAdHoc(false);
        }
        entry.setQuantityNeeded(entry.getQuantityNeeded().add(remaining));
        if (urgent) {
            entry.setUrgent(true);
        }
        stampStockSnapshot(entry, item, raisedBy);
        if (note != null) {
            entry.setNote(note);
        }
        if (entry.getRaisedBy() == null) {
            entry.setRaisedBy(raisedBy);
        }
        return orderListEntryRepository.save(entry);
    }

    // Records the stock and minimum this row is being raised against, from
    // today's count for the item (the latest usable figure, and tomorrow's
    // minimum once End of Day is in -- the same basis the order quantity was
    // worked out on). Only called for a row still waiting to be ordered: once
    // Ordered the system never touches a row, so its figures stay as they were.
    // No count today (a manual "Add to order") leaves the row without a snapshot.
    private void stampStockSnapshot(OrderListEntry entry, StoreInventoryItem item, User actor) {
        stampStockSnapshot(entry, item, actor, LocalDate.now());
    }

    private void stampStockSnapshot(OrderListEntry entry, StoreInventoryItem item, User actor, LocalDate countDate) {
        LocalDate today = LocalDate.now();
        stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(item.getId(), countDate)
            .filter(c -> c.getCurrentCount() != null)
            .ifPresent(c -> {
                // A late End of Day (for yesterday) sets the requirement for today, not tomorrow.
                boolean forTomorrow = c.hasSnapshot(StockCheckSnapshot.END_OF_DAY) && countDate.equals(today);
                entry.setStockSnapshot(
                    c.getCurrentCount(),
                    forTomorrow ? c.getRequiredTomorrow() : item.requiredMinimumOn(today),
                    actor != null ? actor.getFullName() : null,
                    OffsetDateTime.now(),
                    forTomorrow);
            });
    }

    private OrderListEntry doUpsertShortage(Store store, StoreInventoryItem item, BigDecimal quantityNeeded, String note, boolean adHoc, boolean urgent, User raisedBy, Supplier defaultSupplier, LocalDate countDate) {
        // A manual add tops up the Manual column of the item's row that is
        // still waiting to be ordered; only when every active row is already
        // Ordered (or there is none) does it become a row of its own.
        // What a count calls short is net of stock already on order but not yet
        // received (Ordered rows) -- those units are coming, so only the
        // remainder needs a new order. Once such an order is received, stock
        // rises and it stops counting here, so nothing is subtracted twice.
        // Fully covered: no waiting system row is needed, and none is created.
        if (!adHoc) {
            BigDecimal onOrder = orderListEntryRepository
                .findByStoreIdAndStoreInventoryItemIdAndStatusOrderByCreatedAtAsc(store.getId(), item.getId(), OrderStatus.ORDERED)
                .stream().map(OrderListEntry::totalQuantityOrdered).reduce(BigDecimal.ZERO, BigDecimal::add);
            quantityNeeded = quantityNeeded.subtract(onOrder);
            if (quantityNeeded.signum() <= 0) {
                resolveShortageIfPresent(store, item);
                return null;
            }
        }

        // A count likewise updates that same waiting row (keeping any Manual
        // figure) rather than stacking a second one beside it.
        OrderListEntry entry = orderListEntryRepository
            .findByStoreIdAndStoreInventoryItemIdAndStatusOrderByCreatedAtAsc(store.getId(), item.getId(), OrderStatus.NEEDS_ORDERING)
            .stream().findFirst().orElse(null);
        if (entry == null) {
            entry = new OrderListEntry();
            entry.setStore(store);
            entry.setStoreInventoryItem(item);
            entry.setSupplier(defaultSupplier);
            entry.setStatus(OrderStatus.NEEDS_ORDERING);
            entry.setAdHoc(adHoc);
        }

        // A manual add always lands in the Manual column -- on the waiting row
        // or, when there is none, on a fresh row whose Needs column stays 0.
        if (adHoc) {
            entry.setManualAddition(entry.getManualAddition().add(quantityNeeded));
        } else {
            entry.setQuantityNeeded(quantityNeeded);
            entry.setUrgent(urgent);
        }
        stampStockSnapshot(entry, item, raisedBy, countDate);
        if (note != null) {
            entry.setNote(note);
        }
        if (entry.getRaisedBy() == null) {
            entry.setRaisedBy(raisedBy);
        }
        return orderListEntryRepository.save(entry);
    }

    private java.util.Optional<OrderListEntry> openSystemEntry(Store store, StoreInventoryItem item) {
        return orderListEntryRepository
            .findByStoreIdAndStoreInventoryItemIdAndStatusAndAdHocFalse(store.getId(), item.getId(), OrderStatus.NEEDS_ORDERING)
            .stream().findFirst();
    }

    // Start of Day's half of ordering (RTS-369): reconciles the order list with
    // the fresh count. quantityNeeded is today's minimum less the SOD usable
    // stock (0 when the count is sufficient).
    //  - A system Needs Ordering row the admin hasn't acted on (e.g. left over
    //    from yesterday's EOD) is recalculated in place -- or withdrawn when
    //    nothing is short any more -- never duplicated.
    //  - Rows already Ordered are never touched; their quantity is netted off
    //    and only a remaining shortfall becomes a separate Needs Ordering row.
    // Re-saving SOD re-runs this and lands on the same result.
    @Transactional
    // outOfStock flags the row urgent; returns true only when that flag was
    // newly raised, so re-saving the same zero count doesn't re-notify.
    public boolean reconcileStartOfDayShortage(Store store, StoreInventoryItem item, BigDecimal quantityNeeded, boolean outOfStock, User raisedBy, Supplier defaultSupplier) {
        if (quantityNeeded.signum() <= 0) {
            resolveShortageIfPresent(store, item);
            return false;
        }
        boolean wasUrgent = openSystemEntry(store, item).map(OrderListEntry::isUrgent).orElse(false);
        OrderListEntry entry = upsertShortage(store, item, quantityNeeded, null, false, outOfStock, raisedBy, defaultSupplier);
        return outOfStock && entry != null && !wasUrgent;
    }

    // Called whenever a fresh count shows the item back at or above its
    // minimum (quantityNeeded == 0): withdraws the system-raised Needs Ordering
    // row, which was never acted on and is no longer needed. Rows the admin
    // has moved to Ordered, and manually added rows, are left exactly as they
    // are -- the system never changes an order's status for them. History is
    // untouched: the row survives, it just leaves the active (non-RECEIVED) set.
    @Transactional
    public void resolveShortageIfPresent(Store store, StoreInventoryItem item) {
        openSystemEntry(store, item).ifPresent(entry -> {
            entry.setStatus(OrderStatus.RECEIVED);
            entry.setStatusChangedByRole(null);
            orderListEntryRepository.save(entry);
        });
    }

    // Owner/Admin's Supplier Purchasing Summary: the store always comes from
    // the caller's own StoreOwner link (requireActiveStoreOwner), never from a
    // client-supplied store ID, so another store's data can never be reached
    // this way. Aggregation (COUNT/SUM/GROUP BY) happens entirely in
    // findSupplierMetricsForStore -- this method only validates the range and
    // maps the resulting tuples.
    // SUM over NUMERIC comes back as BigDecimal; null when no rows qualify.
    static BigDecimal toDecimal(Object sum) {
        return sum == null ? BigDecimal.ZERO : new BigDecimal(sum.toString());
    }

    @Transactional(readOnly = true)
    public List<SupplierPurchaseMetricResponse> getSupplierMetricsForOwner(Long ownerId, LocalDate fromDate, LocalDate toDate) {
        DateRangeValidator.validate(fromDate, toDate, MAX_DATE_RANGE_DAYS);
        StoreOwner storeOwner = requireActiveStoreOwner(ownerId);

        List<Object[]> rows = orderListEntryRepository.findSupplierMetricsForStore(
            storeOwner.getStore().getId(), OrderStatus.PURCHASED_STATUSES,
            rangeStart(fromDate), rangeEndExclusive(toDate));

        return rows.stream()
            .map(row -> new SupplierPurchaseMetricResponse(
                row[1] != null ? (String) row[1] : NO_SUPPLIER,
                ((Number) row[2]).longValue(),
                toDecimal(row[3]),
                ((Number) row[4]).longValue()
            ))
            .sorted(Comparator.comparing(SupplierPurchaseMetricResponse::supplierName, String.CASE_INSENSITIVE_ORDER))
            .toList();
    }

    private static final int HISTORY_DEFAULT_PAGE_SIZE = 20;
    private static final int HISTORY_MAX_PAGE_SIZE = 100;

    // Order History (Owner/Admin): the Purchasing Report's Detailed view, a
    // per-line complement to getSupplierMetricsForOwner's supplier totals
    // above -- same date-range validation and PURCHASED_STATUSES filter, but
    // every Ordered/Received row itself rather than aggregated counts.
    @Transactional(readOnly = true)
    public OrderHistoryPageResponse getOrderHistoryForOwner(
        Long ownerId, LocalDate fromDate, LocalDate toDate, String supplierName, Integer page, Integer size
    ) {
        StoreOwner storeOwner = requireActiveStoreOwner(ownerId);
        return orderHistoryForStore(storeOwner.getStore().getId(), fromDate, toDate, supplierName, page, size);
    }

    // Super Admin's counterpart, store-id based like listForStore above.
    @Transactional(readOnly = true)
    public OrderHistoryPageResponse getOrderHistoryForStore(
        Long storeId, LocalDate fromDate, LocalDate toDate, String supplierName, Integer page, Integer size
    ) {
        return orderHistoryForStore(storeId, fromDate, toDate, supplierName, page, size);
    }

    private OrderHistoryPageResponse orderHistoryForStore(
        Long storeId, LocalDate fromDate, LocalDate toDate, String supplierName, Integer page, Integer size
    ) {
        DateRangeValidator.validate(fromDate, toDate, MAX_DATE_RANGE_DAYS);

        List<OrderListEntry> all = orderListEntryRepository
            .findByStoreIdAndStatusInAndActivityInRange(
                storeId, OrderStatus.PURCHASED_STATUSES, rangeStart(fromDate), rangeEndExclusive(toDate));

        String needle = supplierName == null ? "" : supplierName.trim();
        List<OrderListEntry> filtered = needle.isEmpty() ? all : all.stream()
            .filter(e -> needle.equalsIgnoreCase(e.getSupplier() != null ? e.getSupplier().getName() : NO_SUPPLIER))
            .toList();

        long awaitingReceiptCount = filtered.stream().filter(e -> e.getStatus() == OrderStatus.ORDERED).count();
        long receivedCount = filtered.stream().filter(e -> e.getStatus() == OrderStatus.RECEIVED).count();

        int requestedPage = page == null ? 1 : Math.max(page, 1);
        int clampedSize = size == null ? HISTORY_DEFAULT_PAGE_SIZE : Math.min(Math.max(size, 1), HISTORY_MAX_PAGE_SIZE);
        int totalPages = Math.max(1, (int) Math.ceil(filtered.size() / (double) clampedSize));
        int currentPage = Math.min(requestedPage, totalPages);
        int fromIndex = Math.min((currentPage - 1) * clampedSize, filtered.size());
        int toIndex = Math.min(fromIndex + clampedSize, filtered.size());

        List<OrderHistoryEntryResponse> pageRows = filtered.subList(fromIndex, toIndex).stream()
            .map(OrderHistoryEntryResponse::from)
            .toList();

        return new OrderHistoryPageResponse(
            pageRows, currentPage, clampedSize, totalPages, filtered.size(), awaitingReceiptCount, receivedCount);
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
