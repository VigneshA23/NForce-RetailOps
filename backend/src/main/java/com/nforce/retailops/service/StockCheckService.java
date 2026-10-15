package com.nforce.retailops.service;

import com.nforce.retailops.dto.AdHocShortageRequest;
import com.nforce.retailops.dto.DailyStockCheckItemResponse;
import com.nforce.retailops.dto.EodSupplierReportResponse;
import com.nforce.retailops.dto.InventoryCountHistoryEntryResponse;
import com.nforce.retailops.dto.InventoryCountRowResponse;
import com.nforce.retailops.dto.InventoryCountSource;
import com.nforce.retailops.dto.InventoryCountStatus;
import com.nforce.retailops.dto.InventoryCountsPageResponse;
import com.nforce.retailops.dto.MissedEndOfDayAnswerRequest;
import com.nforce.retailops.dto.MissedEndOfDayResponse;
import com.nforce.retailops.dto.OrderListEntryResponse;
import com.nforce.retailops.dto.StockCheckCorrectionRequest;
import com.nforce.retailops.dto.StockCheckEditResponse;
import com.nforce.retailops.dto.StockCheckHistoryPageResponse;
import com.nforce.retailops.dto.StockCheckResponse;
import com.nforce.retailops.dto.StockCheckSubmitRequest;
import com.nforce.retailops.dto.StockSnapshotResponse;
import com.nforce.retailops.dto.StoreInventoryItemOptionResponse;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckCorrection;
import com.nforce.retailops.entity.StockCheckReceipt;
import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.StockReceiptRequest;
import com.nforce.retailops.entity.StockReceiptRequestStatus;
import com.nforce.retailops.entity.StockReceiptRequestType;
import com.nforce.retailops.entity.StockShortageReport;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.dto.SuperAdminStockCheckHistoryPageResponse;
import com.nforce.retailops.dto.SuperAdminStockCheckResponse;
import com.nforce.retailops.exception.InvalidStockCheckException;
import com.nforce.retailops.exception.MissedEndOfDayPendingException;
import com.nforce.retailops.exception.StockCheckLockedException;
import com.nforce.retailops.exception.InventoryItemNotAssignedException;
import com.nforce.retailops.exception.StoreInventoryItemNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StockCheckCorrectionRepository;
import com.nforce.retailops.repository.StockCheckReceiptRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StockReceiptRequestRepository;
import com.nforce.retailops.repository.StockShortageReportRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import com.nforce.retailops.util.DateRangeValidator;
import com.nforce.retailops.util.InventoryCountStatusCalculator;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

// Employee-facing daily Start of Day / End of Day stock checks + ad-hoc
// shortage reporting, and Owner/Admin's history, correction and End of Day
// supplier report. Store membership is enforced by the caller via
// UserProfileService.requireAssignedStore before any employee method here
// runs, the same convention TaskService/RaisedIssueService use for /me.
//
// Each item gets one StockCheck row per business day holding both
// snapshots. There is no time window on either: an employee can save or
// re-save today's SOD or EOD whenever the store's workflow calls for it, and
// a re-save updates the row in place (the previous values go to
// stock_check_corrections).
@Service
public class StockCheckService {

    // Owner/Admin history listing: default and max page size for
    // GET /api/stores/inventory/stock-checks. 92 days x a full item list is
    // thousands of rows -- this endpoint is bounded either way.
    private static final int DEFAULT_PAGE_SIZE = 50;
    private static final int MAX_PAGE_SIZE = 200;
    private static final int MAX_DATE_RANGE_DAYS = 92;

    // Super Admin's "every store" history query (RTS-305) is far more
    // expensive per day of range than one store's -- a tighter cap than the
    // per-store 92 days above, per that story's own dev notes.
    private static final int MAX_DATE_RANGE_DAYS_ALL_STORES = 31;

    // Inventory Counts row's expandable count-history timeline: how many of
    // an item's most recent counts and deliveries to show.
    private static final int MAX_HISTORY_ENTRIES = 30;

    static final String NO_SUPPLIER = "No Supplier";

    static final String START_OF_DAY_ORDERED_MESSAGE =
        "An order has been placed based on the Start of Day count, so it can't be edited today.";

    private final StoreInventoryItemRepository storeInventoryItemRepository;
    private final StockCheckRepository stockCheckRepository;
    private final StockCheckCorrectionRepository stockCheckCorrectionRepository;
    private final UserRepository userRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreRepository storeRepository;
    private final OrderListService orderListService;
    private final UserProfileService userProfileService;
    private final NotificationService notificationService;
    private final StockCheckReceiptRepository stockCheckReceiptRepository;
    private final StockReceiptRequestRepository stockReceiptRequestRepository;
    private final StockShortageReportRepository stockShortageReportRepository;

    public StockCheckService(
        StoreInventoryItemRepository storeInventoryItemRepository,
        StockCheckRepository stockCheckRepository,
        StockCheckCorrectionRepository stockCheckCorrectionRepository,
        UserRepository userRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreRepository storeRepository,
        OrderListService orderListService,
        UserProfileService userProfileService,
        NotificationService notificationService,
        StockCheckReceiptRepository stockCheckReceiptRepository,
        StockReceiptRequestRepository stockReceiptRequestRepository,
        StockShortageReportRepository stockShortageReportRepository
    ) {
        this.storeInventoryItemRepository = storeInventoryItemRepository;
        this.stockCheckRepository = stockCheckRepository;
        this.stockCheckCorrectionRepository = stockCheckCorrectionRepository;
        this.userRepository = userRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeRepository = storeRepository;
        this.orderListService = orderListService;
        this.userProfileService = userProfileService;
        this.notificationService = notificationService;
        this.stockCheckReceiptRepository = stockCheckReceiptRepository;
        this.stockReceiptRequestRepository = stockReceiptRequestRepository;
        this.stockShortageReportRepository = stockShortageReportRepository;
    }

    // ---- Employee: today's checklist --------------------------------------

    @Transactional(readOnly = true)
    public List<DailyStockCheckItemResponse> getTodayChecklist(Long employeeUserId, Long storeId) {
        userProfileService.requireAssignedStore(employeeUserId, storeId);
        LocalDate today = LocalDate.now();
        List<StoreInventoryItem> items = storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(storeId);
        Map<Long, StockCheck> todaysChecksByItemId = checksByItemId(storeId, today);
        java.util.Set<Long> unansweredYesterdayItemIds = stockCheckRepository
            .findMissedEndOfDay(storeId, today.minusDays(1)).stream()
            .map(sc -> sc.getStoreInventoryItem().getId())
            .collect(Collectors.toSet());
        java.util.Set<Long> orderedTodayItemIds = orderListService.itemIdsOrderedOn(storeId, today);
        Map<Long, List<OrderListEntry>> orderedByItemId = orderListService.orderedEntriesByItem(storeId);
        List<StockReceiptRequest> pendingRequests = stockReceiptRequestRepository
            .findByStoreIdAndCheckDateAndStatus(storeId, today, StockReceiptRequestStatus.PENDING);
        // Only restock reported with End of Day counts here: a Start of Day restock
        // already sits inside that count.
        Map<Long, BigDecimal> pendingByItemId = pendingRequests.stream()
            .filter(r -> r.getType() == StockReceiptRequestType.RESTOCK && r.getSnapshot() == StockCheckSnapshot.END_OF_DAY)
            .collect(Collectors.groupingBy(
            r -> r.getStoreInventoryItem().getId(),
            Collectors.reducing(BigDecimal.ZERO, StockReceiptRequest::getQuantity, BigDecimal::add)));
        Map<Long, StockCheck> previousByItemId = stockCheckRepository.findLatestBeforeForStore(storeId, today).stream()
            .collect(Collectors.toMap(sc -> sc.getStoreInventoryItem().getId(), Function.identity(), (a, b) -> a));
        Map<Long, List<StockCheckReceipt>> unappliedByItemId = stockCheckReceiptRepository.findUnappliedForStore(storeId).stream()
            .collect(Collectors.groupingBy(r -> r.getStoreInventoryItem().getId()));
        Map<Long, StockReceiptRequest> startReviewByItemId = new java.util.HashMap<>();
        Map<Long, BigDecimal> restockCoveredByItemId = new java.util.HashMap<>();
        Map<Long, BigDecimal> lowerCoveredByItemId = new java.util.HashMap<>();
        for (StockReceiptRequest r : stockReceiptRequestRepository
            .findByStoreIdAndCheckDateAndSnapshotOrderByIdAsc(storeId, today, StockCheckSnapshot.START_OF_DAY)) {
            if (r.getStatus() != StockReceiptRequestStatus.REJECTED) {
                (r.getType() == StockReceiptRequestType.RESTOCK ? restockCoveredByItemId : lowerCoveredByItemId)
                    .merge(r.getStoreInventoryItem().getId(), r.getQuantity(),
                        r.getType() == StockReceiptRequestType.RESTOCK ? BigDecimal::add : BigDecimal::max);
            }
            // A pending request wins over anything decided; otherwise the latest
            // one shows, so a re-save after a rejection reflects its own state.
            Long itemId = r.getStoreInventoryItem().getId();
            StockReceiptRequest current = startReviewByItemId.get(itemId);
            if (current == null || !current.isPending() || r.isPending()) {
                startReviewByItemId.put(itemId, r);
            }
        }
        java.util.Set<Long> orderIdsAwaitingApproval = pendingRequests.stream()
            .filter(r -> r.getOrderListEntry() != null)
            .map(r -> r.getOrderListEntry().getId())
            .collect(Collectors.toSet());

        return items.stream()
            .map(item -> {
                StockCheck check = todaysChecksByItemId.get(item.getId());
                return new DailyStockCheckItemResponse(
                    item.getId(),
                    item.getName(),
                    item.getUnitOfMeasurement(),
                    item.requiredMinimumOn(today),
                    requiredTomorrow(item, check, today),
                    StockSnapshotResponse.from(check, StockCheckSnapshot.START_OF_DAY),
                    StockSnapshotResponse.from(check, StockCheckSnapshot.END_OF_DAY),
                    check != null ? check.getQuantityReceived() : BigDecimal.ZERO,
                    check != null && check.hasSnapshot(StockCheckSnapshot.START_OF_DAY) ? check.getCurrentCount() : null,
                    // Hidden while reported received stock awaits approval: until
                    // then the usage would come out negative.
                    check != null && pendingByItemId.getOrDefault(item.getId(), BigDecimal.ZERO).signum() == 0
                        ? check.stockUsed() : null,
                    quantityToOrder(check),
                    item.getImageId(),
                    pendingByItemId.getOrDefault(item.getId(), BigDecimal.ZERO),
                    orderedByItemId.getOrDefault(item.getId(), List.of()).stream()
                        .filter(e -> !orderIdsAwaitingApproval.contains(e.getId()))
                        .map(e -> new DailyStockCheckItemResponse.OpenOrder(
                            e.getId(), e.totalQuantityOrdered(),
                            e.getSupplier() != null ? e.getSupplier().getName() : null, e.getOrderedAt()))
                        .toList(),
                    previousEndOfDay(
                        previousByItemId.get(item.getId()), unappliedByItemId.getOrDefault(item.getId(), List.of()),
                        restockCoveredByItemId.getOrDefault(item.getId(), BigDecimal.ZERO),
                        lowerCoveredByItemId.getOrDefault(item.getId(), BigDecimal.ZERO)),
                    startOfDayReview(startReviewByItemId.get(item.getId())),
                    check != null && check.hasSnapshot(StockCheckSnapshot.START_OF_DAY)
                        && orderedTodayItemIds.contains(item.getId()),
                    unansweredYesterdayItemIds.contains(item.getId())
                        && (check == null || !check.hasSnapshot(StockCheckSnapshot.START_OF_DAY))
                        ? new DailyStockCheckItemResponse.MissedEndOfDay(today.minusDays(1))
                        : null
                );
            })
            .toList();
    }

    // Last counted day's End of Day, and what Start of Day should come to: that
    // End of Day plus deliveries received after it (a delivery received after a
    // row was first taken is not in that row's counts). Null when the last
    // counted day has no End of Day to compare against.
    private static DailyStockCheckItemResponse.PreviousEndOfDay previousEndOfDay(
        StockCheck previous, List<StockCheckReceipt> unapplied, BigDecimal restockCovered, BigDecimal lowerCovered
    ) {
        if (previous == null || !previous.hasSnapshot(StockCheckSnapshot.END_OF_DAY)) {
            return null;
        }
        // Total on hand, dead stock included: stock going dead overnight is not
        // stock going missing, so Start of Day is reconciled against totals.
        BigDecimal usable = previous.availableFor(StockCheckSnapshot.END_OF_DAY);
        User by = previous.getEndOfDayEnteredBy() != null ? previous.getEndOfDayEnteredBy() : previous.getEndOfDayCheckedBy();
        OffsetDateTime at = previous.getEndOfDayEnteredAt() != null ? previous.getEndOfDayEnteredAt() : previous.getEndOfDayCheckedAt();
        return new DailyStockCheckItemResponse.PreviousEndOfDay(
            previous.getCheckDate(), usable, expectedStart(previous, unapplied),
            by == null ? null : by.getId(), by == null ? null : by.getFullName(), at, restockCovered, lowerCovered);
    }

    private static BigDecimal expectedStart(StockCheck previous, List<StockCheckReceipt> unapplied) {
        return previous.availableFor(StockCheckSnapshot.END_OF_DAY).add(StockCheckReceipt.pendingTotal(unapplied, previous));
    }

    // Pending or rejected only: an approved request needs no flag on the card.
    private static DailyStockCheckItemResponse.StartOfDayReview startOfDayReview(StockReceiptRequest request) {
        if (request == null || request.getStatus() == StockReceiptRequestStatus.APPROVED) {
            return null;
        }
        return new DailyStockCheckItemResponse.StartOfDayReview(
            request.getType().name(), request.getStatus().name(), request.getQuantity(), request.getReason());
    }

    // Full item roster for the employee's "Report Shortage" picker --
    // deliberately the same unfiltered list (active and inactive alike)
    // Owner/Admin sees on the Inventory Items tab, unlike getTodayChecklist
    // above (which is active-only, since that one drives the daily count
    // list and nobody needs to count a deactivated item).
    @Transactional(readOnly = true)
    public List<StoreInventoryItemOptionResponse> listAllItemsForEmployeeStore(Long employeeUserId, Long storeId) {
        userProfileService.requireAssignedStore(employeeUserId, storeId);
        return storeInventoryItemRepository.findByStoreIdOrderById(storeId).stream()
            .map(StoreInventoryItemOptionResponse::from)
            .toList();
    }

    // ---- Employee: save / update a snapshot --------------------------------

    @Transactional
    public StockCheckResponse submitCheck(Long employeeUserId, StockCheckSubmitRequest request) {
        userProfileService.requireAssignedStore(employeeUserId, request.storeId());

        StoreInventoryItem item = storeInventoryItemRepository.findById(request.storeInventoryItemId())
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));

        if (!item.getStore().getId().equals(request.storeId())) {
            throw new StoreInventoryItemNotFoundException("Store inventory item not found");
        }

        if (!item.isActive()) {
            throw new InventoryItemNotAssignedException("This item is not currently active for your store");
        }

        requireDeadStockWithinAvailable(request.available(), request.deadStock());

        User employee = userRepository.getReferenceById(employeeUserId);
        LocalDate today = LocalDate.now();

        StockCheck check = stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(item.getId(), today)
            .orElseGet(() -> {
                StockCheck created = new StockCheck();
                created.setStore(item.getStore());
                created.setStoreInventoryItem(item);
                created.setSupplier(item.getPreferredSupplier());
                created.setCheckDate(today);
                return created;
            });

        // Yesterday's End of Day must be answered (counted or explained) before
        // today's Start of Day for the item can be taken.
        if (request.snapshot() == StockCheckSnapshot.START_OF_DAY && !check.hasSnapshot(StockCheckSnapshot.START_OF_DAY)) {
            stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(item.getId(), today.minusDays(1))
                .filter(y -> y.hasSnapshot(StockCheckSnapshot.START_OF_DAY)
                    && !y.hasSnapshot(StockCheckSnapshot.END_OF_DAY) && !y.isEndOfDaySkipped())
                .ifPresent(y -> {
                    throw new MissedEndOfDayPendingException(
                        "Yesterday's End of Day count for " + item.getName() + " is missing. "
                            + "Respond to it from your notifications, then take today's Start of Day.");
                });
        }

        // First responder owns the snapshot: later employees can't overwrite
        // or edit it. (Owner/Admin corrections go through correctCheck.)
        if (check.hasSnapshot(request.snapshot())) {
            User firstEnterer = request.snapshot() == StockCheckSnapshot.START_OF_DAY
                ? check.getStartOfDayEnteredBy()
                : check.getEndOfDayEnteredBy();
            if (firstEnterer != null && !firstEnterer.getId().equals(employeeUserId)) {
                throw new StockCheckLockedException(
                    "This check was already submitted by " + firstEnterer.getFullName()
                        + ". Only they can edit it.");
            }
        }

        // Once the admin has marked the order raised from this Start of Day as
        // Ordered, today's Start of Day is frozen for everyone (Owner/Admin
        // corrections still go through correctCheck).
        if (request.snapshot() == StockCheckSnapshot.START_OF_DAY
            && check.hasSnapshot(StockCheckSnapshot.START_OF_DAY)
            && orderListService.itemIdsOrderedOn(request.storeId(), today).contains(item.getId())) {
            throw new StockCheckLockedException(START_OF_DAY_ORDERED_MESSAGE);
        }

        // Reported stock is only a request here: nothing about quantities or
        // the order is changed until the admin approves it (see
        // StockReceiptApprovalService).
        record Delivery(OrderListEntry order, BigDecimal quantity) {
        }
        List<Delivery> deliveries = new ArrayList<>();
        java.util.Set<Long> seenOrders = new java.util.HashSet<>();
        boolean seenNewStock = false;
        for (StockCheckSubmitRequest.ReceivedItem reported : request.deliveries()) {
            BigDecimal quantity = reported.quantity() == null ? BigDecimal.ZERO : reported.quantity();
            OrderListEntry order = null;
            if (reported.orderEntryId() != null) {
                if (!seenOrders.add(reported.orderEntryId())) {
                    throw new InvalidStockCheckException("An order can only be reported once");
                }
                order = orderListService.requireOrderedEntry(request.storeId(), item.getId(), reported.orderEntryId());
                if (stockReceiptRequestRepository.existsByOrderListEntryIdAndStatus(order.getId(), StockReceiptRequestStatus.PENDING)) {
                    throw new InvalidStockCheckException("This order is already waiting for admin approval");
                }
                if (quantity.signum() == 0) {
                    quantity = order.totalQuantityOrdered();
                }
            } else {
                if (seenNewStock) {
                    throw new InvalidStockCheckException("New stock can only be reported once");
                }
                seenNewStock = true;
            }
            if (quantity.signum() > 0) {
                deliveries.add(new Delivery(order, quantity));
            }
        }
        BigDecimal received = deliveries.stream().map(Delivery::quantity).reduce(BigDecimal.ZERO, BigDecimal::add);
        boolean hasDelivery = !deliveries.isEmpty();

        // Start of Day is reconciled against the last counted End of Day: it may
        // match, be higher (stock was restocked: the employee must say so) or be
        // lower (needs a reason and the admin approving it). Nothing is saved
        // yet, so a refused count leaves the row untouched.
        BigDecimal startGap = null;
        if (request.snapshot() == StockCheckSnapshot.START_OF_DAY) {
            startGap = startOfDayGap(item, today, request.available());
            if (hasDelivery && (startGap == null || startGap.signum() <= 0)) {
                throw new InvalidStockCheckException(
                    "Start of Day is not higher than the last End of Day, so there is no restock to report");
            }
        } else if (hasDelivery && !check.hasSnapshot(StockCheckSnapshot.START_OF_DAY)) {
            throw new InvalidStockCheckException("Submit today's Start of Day stock check before recording received stock");
        }
        boolean lowerStart = startGap != null && startGap.signum() < 0;
        String lowerReason = request.lowerCountReason() == null ? "" : request.lowerCountReason().trim();
        StockReceiptRequest coveringLower = null;
        if (lowerStart) {
            coveringLower = stockReceiptRequestRepository
                .findFirstByStoreInventoryItemIdAndCheckDateAndTypeAndStatusInOrderByIdDesc(
                    item.getId(), today, StockReceiptRequestType.LOWER_COUNT,
                    List.of(StockReceiptRequestStatus.PENDING, StockReceiptRequestStatus.APPROVED))
                .orElse(null);
            boolean alreadyCovered = coveringLower != null && coveringLower.getQuantity().compareTo(startGap.negate()) >= 0;
            if (lowerReason.isEmpty() && !alreadyCovered) {
                throw new InvalidStockCheckException(
                    "Start of Day is lower than the last End of Day. Give a reason and request approval from your admin");
            }
        }

        if (startGap != null && startGap.signum() > 0) {
            BigDecimal covered = stockReceiptRequestRepository.startRestockCoveredFor(item.getId(), today);
            BigDecimal explainedAtStart = (covered == null ? BigDecimal.ZERO : covered).add(received);
            if (explainedAtStart.compareTo(startGap) < 0) {
                throw new InvalidStockCheckException(
                    "Start of Day is higher than the last End of Day. Enter the stock restocked");
            }
        }
        check = applySnapshot(check, request.snapshot(), request.available(), request.deadStock(), employee, null, null, false);
        // A closing count above what the opening count plus deliveries can
        // explain means stock arrived that wasn't recorded. Deliveries still
        // waiting on approval count towards that, so re-saving the count while
        // one is pending doesn't ask again. Rolls the save back.
        if (request.snapshot() == StockCheckSnapshot.END_OF_DAY && check.stockUsed() != null) {
            BigDecimal alreadyPending = stockReceiptRequestRepository.pendingQuantityFor(item.getId(), today);
            BigDecimal explained = (alreadyPending == null ? BigDecimal.ZERO : alreadyPending).add(received);
            if (check.stockUsed().add(explained).signum() < 0) {
                throw new InvalidStockCheckException(
                    "End of Day is higher than Start of Day plus stock received. Enter the stock received today");
            }
        }
        if (lowerStart && !lowerReason.isEmpty()) {
            raiseLowerCountRequest(item, today, startGap.negate(), lowerReason, coveringLower, employee);
        }
        for (Delivery delivery : deliveries) {
            StockReceiptRequest receiptRequest = new StockReceiptRequest();
            receiptRequest.setSnapshot(request.snapshot());
            receiptRequest.setStore(item.getStore());
            receiptRequest.setStoreInventoryItem(item);
            receiptRequest.setOrderListEntry(delivery.order());
            receiptRequest.setCheckDate(today);
            receiptRequest.setQuantity(delivery.quantity());
            receiptRequest.setRequestedBy(employee);
            StockReceiptRequest savedRequest = stockReceiptRequestRepository.save(receiptRequest);
            storeOwnerRepository.findByStoreIdAndActiveTrue(item.getStore().getId())
                .map(StoreOwner::getOwner)
                .ifPresent(owner -> notificationService.notifyOwnerOfStockReceiptRequest(savedRequest, owner));
        }
        syncOrderList(check, request.snapshot(), employee);
        return StockCheckResponse.from(check);
    }

    // Start of Day total (dead stock included) minus what it should be (the last
    // counted day's End of Day total plus deliveries since). Null when there is nothing to compare with.
    private BigDecimal startOfDayGap(StoreInventoryItem item, LocalDate today, BigDecimal startUsable) {
        StockCheck previous = stockCheckRepository
            .findFirstByStoreInventoryItemIdAndCheckDateBeforeOrderByCheckDateDesc(item.getId(), today)
            .orElse(null);
        if (previous == null || !previous.hasSnapshot(StockCheckSnapshot.END_OF_DAY)) {
            return null;
        }
        return startUsable.subtract(expectedStart(previous, stockCheckReceiptRepository.findUnappliedForItem(item.getId())));
    }

    // One open lower-count request per item and day: a re-save while it is
    // pending updates it instead of notifying the admin a second time.
    private void raiseLowerCountRequest(
        StoreInventoryItem item, LocalDate today, BigDecimal shortfall, String reason, StockReceiptRequest existing, User employee
    ) {
        if (existing != null && existing.isPending()) {
            existing.setQuantity(shortfall);
            existing.setReason(reason);
            stockReceiptRequestRepository.save(existing);
            return;
        }
        StockReceiptRequest lower = new StockReceiptRequest();
        lower.setStore(item.getStore());
        lower.setStoreInventoryItem(item);
        lower.setCheckDate(today);
        lower.setSnapshot(StockCheckSnapshot.START_OF_DAY);
        lower.setType(StockReceiptRequestType.LOWER_COUNT);
        lower.setQuantity(shortfall);
        lower.setReason(reason);
        lower.setRequestedBy(employee);
        StockReceiptRequest saved = stockReceiptRequestRepository.save(lower);
        storeOwnerRepository.findByStoreIdAndActiveTrue(item.getStore().getId())
            .map(StoreOwner::getOwner)
            .ifPresent(owner -> notificationService.notifyOwnerOfStockReceiptRequest(saved, owner));
    }

    // The stock side of an approved received-stock request: the delivery goes
    // on the day's received total (the closing count already includes it, so
    // it is not added to the count) and a receipt row records who received it.
    @Transactional
    public void applyApprovedDelivery(StockReceiptRequest request) {
        StoreInventoryItem item = request.getStoreInventoryItem();
        StockCheck check = stockCheckRepository.findByStoreInventoryItemIdAndCheckDate(item.getId(), request.getCheckDate())
            .orElseThrow(() -> new InvalidStockCheckException("The stock check this delivery was reported on no longer exists"));
        // A Start of Day restock is already inside that count, so only an End of
        // Day one raises the day's received total (usage is Start + received - End).
        if (request.getSnapshot() == StockCheckSnapshot.END_OF_DAY) {
            check.recordDelivery(request.getQuantity());
            check = stockCheckRepository.save(check);
        }

        StockCheckReceipt receipt = new StockCheckReceipt();
        receipt.setStore(item.getStore());
        receipt.setStoreInventoryItem(item);
        receipt.setStockCheck(check);
        receipt.setQuantity(request.getQuantity());
        receipt.setCountAfter(check.getCurrentCount());
        receipt.setReceivedByUser(request.getRequestedBy());
        stockCheckReceiptRepository.save(receipt);
    }

    // ---- Missed End of Day: yesterday's count nobody took ---------------------

    // Minimum length of the "could not count" explanation.
    static final int MIN_SKIP_REASON_WORDS = 15;

    @Transactional
    public MissedEndOfDayResponse.Item answerMissedEndOfDayAsEmployee(Long employeeUserId, MissedEndOfDayAnswerRequest request) {
        if (request.storeId() == null) {
            throw new InvalidStockCheckException("Store is required");
        }
        userProfileService.requireAssignedStore(employeeUserId, request.storeId());
        return answerMissedEndOfDay(userRepository.getReferenceById(employeeUserId), request.storeId(), request);
    }

    @Transactional
    public MissedEndOfDayResponse.Item answerMissedEndOfDayAsOwner(Long ownerId, MissedEndOfDayAnswerRequest request) {
        Long storeId = requireActiveStoreOwner(ownerId).getStore().getId();
        return answerMissedEndOfDay(userRepository.getReferenceById(ownerId), storeId, request);
    }

    // Yesterday only, and only the first answer is accepted: either the count
    // itself (saved as End of Day, entered-by = whoever answers; no order list
    // change, today's Start of Day settles that) or a recorded reason with End
    // of Day left empty.
    private MissedEndOfDayResponse.Item answerMissedEndOfDay(User actor, Long storeId, MissedEndOfDayAnswerRequest request) {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        StockCheck check = stockCheckRepository.lockByItemAndDate(request.storeInventoryItemId(), yesterday)
            .filter(c -> c.getStore().getId().equals(storeId))
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Stock check not found"));
        if (!check.hasSnapshot(StockCheckSnapshot.START_OF_DAY)) {
            throw new InvalidStockCheckException("There is no Start of Day count for that day to follow up");
        }
        MissedEndOfDayResponse.Item existing = MissedEndOfDayResponse.Item.from(check);
        if (!MissedEndOfDayResponse.PENDING.equals(existing.status())) {
            throw new StockCheckLockedException(
                "This End of Day was already answered"
                    + (existing.answeredByName() != null ? " by " + existing.answeredByName() : "") + ".");
        }

        if (request.couldNotCount()) {
            String reason = request.reason() == null ? "" : request.reason().trim();
            if (reason.isEmpty() || reason.split("\\s+").length < MIN_SKIP_REASON_WORDS) {
                throw new InvalidStockCheckException(
                    "Explain why it could not be counted in at least " + MIN_SKIP_REASON_WORDS + " words");
            }
            check.skipEndOfDay(reason, actor, OffsetDateTime.now());
            return MissedEndOfDayResponse.Item.from(stockCheckRepository.save(check));
        }

        if (request.available() == null || request.deadStock() == null) {
            throw new InvalidStockCheckException("Enter the available and dead stock, or say it could not be counted");
        }
        requireDeadStockWithinAvailable(request.available(), request.deadStock());
        check = applySnapshot(check, StockCheckSnapshot.END_OF_DAY, request.available(), request.deadStock(), actor, null, null, false);
        if (check.stockUsed() != null && check.stockUsed().signum() < 0) {
            throw new InvalidStockCheckException(
                "End of Day is higher than Start of Day plus stock received that day. "
                    + "Ask your admin to correct it from Stock Check History");
        }
        return MissedEndOfDayResponse.Item.from(check);
    }

    // ---- Employee: ad-hoc shortage report ----------------------------------

    @Transactional
    public void reportAdHocShortage(Long employeeUserId, Long storeId, AdHocShortageRequest request) {
        userProfileService.requireAssignedStore(employeeUserId, storeId);

        StoreInventoryItem storeItem = storeInventoryItemRepository.findById(request.storeInventoryItemId())
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));

        if (!storeItem.getStore().getId().equals(storeId) || !storeItem.isActive()) {
            throw new InventoryItemNotAssignedException("This item is not assigned to your store");
        }

        // A shortage can only be reported against an item whose Start of Day
        // count has been saved today.
        StockCheck check = stockCheckRepository
            .findByStoreInventoryItemIdAndCheckDate(storeItem.getId(), LocalDate.now())
            .filter(c -> c.getStartOfDayAvailable() != null)
            .orElseThrow(() -> new InventoryItemNotAssignedException(
                "Submit today's Start of Day stock check for this item before reporting a shortage"));

        // End of Day is the final count and already settles usage and the
        // order, so a mid-day figure after it would only muddle both.
        if (check.hasSnapshot(StockCheckSnapshot.END_OF_DAY)) {
            throw new InvalidStockCheckException(
                "End of Day is already saved for this item. Edit the End of Day count instead");
        }

        User employee = userRepository.getReferenceById(employeeUserId);

        // Bank the usage so far; the current count follows the figure given.
        check.recordMidDayCount(request.currentStock(), employee);
        stockCheckRepository.save(check);

        StockShortageReport report = new StockShortageReport();
        report.setStore(storeItem.getStore());
        report.setStoreInventoryItem(storeItem);
        report.setCheckDate(LocalDate.now());
        report.setReportedUsable(request.currentStock());
        report.setReportedBy(employee);
        report.setNote(request.note());
        stockShortageReportRepository.save(report);

        // The employee no longer types a quantity: what is needed is today's
        // minimum less what is left. upsertReportedShortage then nets off what
        // is already on the order list.
        boolean outOfStock = request.currentStock().signum() == 0;
        BigDecimal minimum = storeItem.requiredMinimumOn(LocalDate.now());
        BigDecimal required = minimum == null
            ? BigDecimal.ZERO
            : minimum.subtract(request.currentStock()).max(BigDecimal.ZERO);

        OrderListEntry raised = orderListService.upsertReportedShortage(
            storeItem.getStore(), storeItem, required,
            request.note(), employee, storeItem.getPreferredSupplier(),
            Boolean.TRUE.equals(request.orderedAlreadyReceived()),
            outOfStock
        );

        storeOwnerRepository.findByStoreIdAndActiveTrue(storeItem.getStore().getId())
            .map(StoreOwner::getOwner)
            .ifPresent(owner -> {
                if (outOfStock) {
                    notificationService.notifyOwnerOfStockOut(storeItem, employee, "reported", owner);
                } else {
                    notificationService.notifyOwnerOfReportedShortage(
                        storeItem, employee, request.currentStock(), required, raised != null, request.note(), owner);
                }
            });
    }

    // ---- Owner/Admin: history, correction, EOD report -----------------------

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
    public StockCheckHistoryPageResponse listHistoricalChecks(
        Long ownerId, LocalDate startDate, LocalDate endDate, Integer page, Integer size
    ) {
        StoreOwner storeOwner = requireActiveStoreOwner(ownerId);
        return historicalChecksForStore(storeOwner.getStore().getId(), startDate, endDate, page, size);
    }

    // Employee-facing mirror of the Owner/Admin history above, scoped to one
    // of the caller's own assigned stores (requireAssignedStore) rather than
    // the owner's single active store. Read-only -- corrections stay
    // Owner/Admin-only via correctCheck below.
    @Transactional(readOnly = true)
    public StockCheckHistoryPageResponse listHistoricalChecksForEmployee(
        Long employeeUserId, Long storeId, LocalDate startDate, LocalDate endDate, Integer page, Integer size
    ) {
        userProfileService.requireAssignedStore(employeeUserId, storeId);
        return historicalChecksForStore(storeId, startDate, endDate, page, size);
    }

    private StockCheckHistoryPageResponse historicalChecksForStore(
        Long storeId, LocalDate startDate, LocalDate endDate, Integer page, Integer size
    ) {
        DateRangeValidator.validate(startDate, endDate, MAX_DATE_RANGE_DAYS);

        int requestedPage = page == null ? 1 : page;
        int clampedPage = Math.max(requestedPage, 1);
        int clampedSize = size == null ? DEFAULT_PAGE_SIZE : Math.min(Math.max(size, 1), MAX_PAGE_SIZE);

        Page<StockCheck> resultPage = stockCheckRepository.findForStoreInRange(
            storeId, startDate, endDate, PageRequest.of(clampedPage - 1, clampedSize)
        );

        List<Long> checkIds = resultPage.getContent().stream().map(StockCheck::getId).toList();
        Map<Long, List<StockCheckEditResponse>> editsByCheckId = checkIds.isEmpty()
            ? Map.of()
            : stockCheckCorrectionRepository.findWithEditorByStockCheckIds(checkIds).stream()
                .collect(Collectors.groupingBy(
                    c -> c.getStockCheck().getId(),
                    Collectors.mapping(StockCheckEditResponse::from, Collectors.toList())
                ));

        List<StockCheckResponse> items = resultPage.getContent().stream()
            .map(check -> StockCheckResponse.from(check, editsByCheckId.getOrDefault(check.getId(), List.of())))
            .toList();

        return new StockCheckHistoryPageResponse(
            items, clampedPage, clampedSize, resultPage.getTotalPages(), resultPage.getTotalElements()
        );
    }

    // Super Admin's cross-store history (RTS-305): storeId == null means
    // "every store" (the tighter MAX_DATE_RANGE_DAYS_ALL_STORES cap applies),
    // a given storeId means "just that one" (same 92-day cap and same query
    // historicalChecksForStore already uses for Owner/Admin -- no more
    // expensive than what Owner/Admin already runs). Always returns the
    // store-labelled row shape so the frontend has one response shape to
    // handle regardless of scope.
    @Transactional(readOnly = true)
    public SuperAdminStockCheckHistoryPageResponse listHistoricalChecksForSuperAdmin(
        Long storeId, LocalDate startDate, LocalDate endDate, Integer page, Integer size
    ) {
        if (storeId != null) {
            StockCheckHistoryPageResponse scoped = historicalChecksForStore(storeId, startDate, endDate, page, size);
            Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new StoreNotFoundException("Store not found"));
            List<SuperAdminStockCheckResponse> items = scoped.items().stream()
                .map(check -> new SuperAdminStockCheckResponse(store.getId(), store.getName(), check))
                .toList();
            return new SuperAdminStockCheckHistoryPageResponse(
                items, scoped.page(), scoped.pageSize(), scoped.pageCount(), scoped.totalItems()
            );
        }

        DateRangeValidator.validate(startDate, endDate, MAX_DATE_RANGE_DAYS_ALL_STORES);

        int requestedPage = page == null ? 1 : page;
        int clampedPage = Math.max(requestedPage, 1);
        int clampedSize = size == null ? DEFAULT_PAGE_SIZE : Math.min(Math.max(size, 1), MAX_PAGE_SIZE);

        Page<StockCheck> resultPage = stockCheckRepository.findInRange(
            startDate, endDate, PageRequest.of(clampedPage - 1, clampedSize)
        );

        List<Long> checkIds = resultPage.getContent().stream().map(StockCheck::getId).toList();
        Map<Long, List<StockCheckEditResponse>> editsByCheckId = checkIds.isEmpty()
            ? Map.of()
            : stockCheckCorrectionRepository.findWithEditorByStockCheckIds(checkIds).stream()
                .collect(Collectors.groupingBy(
                    c -> c.getStockCheck().getId(),
                    Collectors.mapping(StockCheckEditResponse::from, Collectors.toList())
                ));

        List<SuperAdminStockCheckResponse> items = resultPage.getContent().stream()
            .map(check -> new SuperAdminStockCheckResponse(
                check.getStore().getId(), check.getStore().getName(),
                StockCheckResponse.from(check, editsByCheckId.getOrDefault(check.getId(), List.of()))
            ))
            .toList();

        return new SuperAdminStockCheckHistoryPageResponse(
            items, clampedPage, clampedSize, resultPage.getTotalPages(), resultPage.getTotalElements()
        );
    }

    @Transactional
    public StockCheckResponse correctCheck(Long ownerId, Long checkId, StockCheckCorrectionRequest request) {
        StoreOwner storeOwner = requireActiveStoreOwner(ownerId);

        StockCheck check = stockCheckRepository.findByIdAndStoreId(checkId, storeOwner.getStore().getId())
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Stock check not found"));

        requireDeadStockWithinAvailable(request.available(), request.deadStock());

        User owner = userRepository.getReferenceById(ownerId);
        check = applySnapshot(check, request.snapshot(), request.available(), request.deadStock(), owner, null, request.reason(), true);

        // Only propagate to the order list for TODAY's record -- correcting a
        // stale historical entry shouldn't resurrect or distort today's live
        // order queue.
        if (check.getCheckDate().isEqual(LocalDate.now())) {
            syncOrderList(check, request.snapshot(), check.getCheckedBy());
        }

        // Returned with the check's own up-to-date edit list (rather than the
        // empty list the single-arg StockCheckResponse.from gives) so the
        // caller sees the correction it just made without a separate refetch.
        List<StockCheckEditResponse> edits = stockCheckCorrectionRepository
            .findWithEditorByStockCheckIds(List.of(check.getId())).stream()
            .map(StockCheckEditResponse::from)
            .toList();
        return StockCheckResponse.from(check, edits);
    }

    // Super Admin's cross-store correction (RTS-306): storeId is taken
    // directly from the request path (no owner-link resolution -- a Super
    // Admin can act on any store), and the reason is mandatory here (unlike
    // Owner/Admin's optional one above), since a Super Admin is editing data
    // they didn't enter themselves. Shares applySnapshot/the same audit trail
    // and order-list sync as correctCheck, per RTS-306's own dev notes
    // ("one validation and audit code path"), and notifies the store's
    // active owner (if any) that their data changed under them.
    @Transactional
    public StockCheckResponse correctCheckForSuperAdmin(
        Long storeId, Long checkId, SuperAdmin superAdmin, StockCheckCorrectionRequest request
    ) {
        if (request.reason() == null || request.reason().isBlank()) {
            throw new InvalidStockCheckException("A reason is required for Super Admin corrections");
        }

        StockCheck check = stockCheckRepository.findByIdAndStoreId(checkId, storeId)
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Stock check not found"));

        requireDeadStockWithinAvailable(request.available(), request.deadStock());

        check = applySnapshot(check, request.snapshot(), request.available(), request.deadStock(), null, superAdmin, request.reason(), true);

        if (check.getCheckDate().isEqual(LocalDate.now())) {
            syncOrderList(check, request.snapshot(), check.getCheckedBy());
        }

        List<StockCheckEditResponse> edits = stockCheckCorrectionRepository
            .findWithEditorByStockCheckIds(List.of(check.getId())).stream()
            .map(StockCheckEditResponse::from)
            .toList();

        StockCheck notifiedCheck = check;
        storeOwnerRepository.findByStoreIdAndActiveTrue(storeId)
            .map(StoreOwner::getOwner)
            .ifPresent(owner -> notificationService.notifyOwnerOfSuperAdminStockCheckCorrection(notifiedCheck, owner));

        return StockCheckResponse.from(check, edits);
    }

    // Every active item plus any inactive one that was counted that day,
    // grouped by preferred supplier. A day without End of Day shows its
    // tomorrow's requirement from the item's current thresholds.
    @Transactional(readOnly = true)
    public EodSupplierReportResponse getEodSupplierReport(Long ownerId, LocalDate date) {
        Long storeId = requireActiveStoreOwner(ownerId).getStore().getId();
        return eodSupplierReportForStore(storeId, date);
    }

    // Super Admin's cross-store mirror (RTS-304 Orders dashboard parity):
    // storeId is taken directly rather than resolved from an owner link, same
    // precedent as correctCheckForSuperAdmin/listHistoricalChecksForSuperAdmin
    // above -- no active-owner requirement, since a Super Admin can view a
    // vacant store's report too.
    @Transactional(readOnly = true)
    public EodSupplierReportResponse getEodSupplierReportForSuperAdmin(Long storeId, LocalDate date) {
        return eodSupplierReportForStore(storeId, date);
    }

    private EodSupplierReportResponse eodSupplierReportForStore(Long storeId, LocalDate date) {
        LocalDate reportDate = date != null ? date : LocalDate.now();
        if (reportDate.isAfter(LocalDate.now())) {
            throw new InvalidStockCheckException("The report date cannot be in the future");
        }

        Map<Long, StockCheck> checksByItemId = checksByItemId(storeId, reportDate);
        List<StoreInventoryItem> items = storeInventoryItemRepository.findByStoreIdOrderById(storeId).stream()
            .filter(item -> item.isActive() || checksByItemId.containsKey(item.getId()))
            .sorted(Comparator.comparing(StoreInventoryItem::getName, String.CASE_INSENSITIVE_ORDER))
            .toList();

        // Each item's active (not yet RECEIVED) Order List entry -- drives the
        // Ordered status/quantity and the "mark ordered" action, so this report
        // reflects the Orders page without a trip there. An item can have
        // several (each requirement is its own row); the Needs Ordering one is
        // surfaced so there is always something to act on.
        Map<Long, OrderListEntryResponse> activeOrderByItemId = orderListService.listForStore(storeId).stream()
            .filter(entry -> !"RECEIVED".equals(entry.status()))
            .collect(Collectors.toMap(
                OrderListEntryResponse::storeInventoryItemId,
                entry -> entry,
                (a, b) -> "NEEDS_ORDERING".equals(b.status()) && !"NEEDS_ORDERING".equals(a.status()) ? b : a
            ));

        // Permanent record of orders (kept after Received), so a past day's
        // report still shows what was ordered and when.
        Map<Long, OrderListService.OrderedInfo> orderedByItemId = orderListService.orderedInfoByItemFor(storeId, reportDate);

        Map<Long, List<EodSupplierReportResponse.Row>> rowsBySupplierId = new LinkedHashMap<>();
        Map<Long, Supplier> suppliersById = new LinkedHashMap<>();
        List<EodSupplierReportResponse.Row> noSupplierRows = new ArrayList<>();
        int needingOrder = 0;
        int pendingEod = 0;

        // Today's Start of Day in, End of Day not: an earlier shortage's order
        // has been recalculated from the latest stock, so it can't be marked
        // Ordered from this report any more (RTS-369).
        LocalDate today = LocalDate.now();
        Map<Long, StockCheck> todaysChecksByItemId = reportDate.equals(today)
            ? checksByItemId
            : reportDate.equals(today.minusDays(1)) ? checksByItemId(storeId, today) : Map.of();

        for (StoreInventoryItem item : items) {
            StockCheck check = checksByItemId.get(item.getId());
            StockCheck todaysCheck = todaysChecksByItemId.get(item.getId());
            boolean reconciledBySod = todaysCheck != null
                && todaysCheck.hasSnapshot(StockCheckSnapshot.START_OF_DAY)
                && !todaysCheck.hasSnapshot(StockCheckSnapshot.END_OF_DAY);
            EodSupplierReportResponse.Row row = toReportRow(
                item, check, reportDate, activeOrderByItemId.get(item.getId()), orderedByItemId.get(item.getId()), reconciledBySod);
            if (row.status() == EodSupplierReportResponse.Status.NEEDS_TO_ORDER) needingOrder++;
            if (row.status() == EodSupplierReportResponse.Status.END_OF_DAY_PENDING) pendingEod++;

            // A counted day keeps the supplier recorded then; an uncounted
            // day falls back to the item's current one.
            Supplier supplier = check != null ? check.getSupplier() : item.getPreferredSupplier();
            if (supplier == null) {
                noSupplierRows.add(row);
            } else {
                suppliersById.putIfAbsent(supplier.getId(), supplier);
                rowsBySupplierId.computeIfAbsent(supplier.getId(), id -> new ArrayList<>()).add(row);
            }
        }

        List<EodSupplierReportResponse.Group> groups = new ArrayList<>(suppliersById.values().stream()
            .sorted(Comparator.comparing(Supplier::getName, String.CASE_INSENSITIVE_ORDER))
            .map(s -> new EodSupplierReportResponse.Group(s.getId(), s.getName(), rowsBySupplierId.get(s.getId())))
            .toList());
        if (!noSupplierRows.isEmpty()) {
            groups.add(new EodSupplierReportResponse.Group(null, NO_SUPPLIER, noSupplierRows));
        }

        return new EodSupplierReportResponse(reportDate, groups, needingOrder, pendingEod);
    }

    // Live per-item stock status for the Inventory Counts view: current
    // usable stock, today's minimum, a status tier, who/when last touched it,
    // and the change vs. the previous count on record. KPI counts are over
    // every active item regardless of the search/category/level filters
    // applied to rows (see InventoryCountsPageResponse).
    @Transactional(readOnly = true)
    public InventoryCountsPageResponse listInventoryCounts(
        Long ownerId, String search, String category, String level, Integer page, Integer size
    ) {
        Long storeId = requireActiveStoreOwner(ownerId).getStore().getId();
        return inventoryCountsForStore(storeId, search, category, level, page, size);
    }

    // Super Admin's cross-store mirror -- same storeId-direct pattern as
    // getEodSupplierReportForSuperAdmin above.
    @Transactional(readOnly = true)
    public InventoryCountsPageResponse listInventoryCountsForSuperAdmin(
        Long storeId, String search, String category, String level, Integer page, Integer size
    ) {
        return inventoryCountsForStore(storeId, search, category, level, page, size);
    }

    private InventoryCountsPageResponse inventoryCountsForStore(
        Long storeId, String search, String category, String level, Integer page, Integer size
    ) {
        LocalDate today = LocalDate.now();

        List<StoreInventoryItem> items = storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(storeId);
        Map<Long, StockCheck> latestByItemId = stockCheckRepository.findLatestPerItemForStore(storeId).stream()
            .collect(Collectors.toMap(sc -> sc.getStoreInventoryItem().getId(), Function.identity()));

        Map<Long, StockCheckReceipt> latestReceiptByItemId = stockCheckReceiptRepository.findLatestPerItemForStore(storeId).stream()
            .collect(Collectors.toMap(r -> r.getStoreInventoryItem().getId(), Function.identity(), (a, b) -> a));
        Map<Long, List<StockCheckReceipt>> unappliedByItemId = stockCheckReceiptRepository.findUnappliedForStore(storeId).stream()
            .collect(Collectors.groupingBy(r -> r.getStoreInventoryItem().getId()));
        Map<Long, StockShortageReport> latestReportByItemId = stockShortageReportRepository.findLatestPerItemForStore(storeId).stream()
            .collect(Collectors.toMap(r -> r.getStoreInventoryItem().getId(), Function.identity(), (a, b) -> a));

        List<InventoryCountRowResponse> allRows = items.stream()
            .map(item -> toCountRow(
                item, latestByItemId.get(item.getId()), latestReceiptByItemId.get(item.getId()),
                latestReportByItemId.get(item.getId()),
                unappliedByItemId.getOrDefault(item.getId(), List.of()), today))
            .toList();

        long allCount = allRows.size();
        long outCount = allRows.stream().filter(r -> r.status() == InventoryCountStatus.OUT_OF_STOCK).count();
        long lowCount = allRows.stream().filter(r -> r.status() == InventoryCountStatus.LOW).count();
        long staleCount = allRows.stream().filter(r -> r.status() == InventoryCountStatus.STALE).count();

        String needle = search == null ? "" : search.trim().toLowerCase();
        List<InventoryCountRowResponse> filtered = allRows.stream()
            .filter(r -> needle.isEmpty() || r.name().toLowerCase().contains(needle))
            .filter(r -> category == null || category.isBlank() || category.equalsIgnoreCase(r.category()))
            .filter(r -> matchesLevel(r.status(), level))
            .toList();

        int requestedPage = page == null ? 1 : Math.max(page, 1);
        int clampedSize = size == null ? DEFAULT_PAGE_SIZE : Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int totalPages = Math.max(1, (int) Math.ceil(filtered.size() / (double) clampedSize));
        int clampedPage = Math.min(requestedPage, totalPages);
        int fromIndex = Math.min((clampedPage - 1) * clampedSize, filtered.size());
        int toIndex = Math.min(fromIndex + clampedSize, filtered.size());

        return new InventoryCountsPageResponse(
            filtered.subList(fromIndex, toIndex), clampedPage, clampedSize, totalPages, filtered.size(),
            allCount, outCount, lowCount, staleCount
        );
    }

    private static boolean matchesLevel(InventoryCountStatus status, String level) {
        if (level == null || level.equalsIgnoreCase("all")) return true;
        return switch (level.toLowerCase()) {
            case "out" -> status == InventoryCountStatus.OUT_OF_STOCK;
            case "low" -> status == InventoryCountStatus.LOW;
            case "stale" -> status == InventoryCountStatus.STALE;
            case "healthy", "ok" -> status == InventoryCountStatus.HEALTHY;
            default -> true;
        };
    }

    private InventoryCountRowResponse toCountRow(
        StoreInventoryItem item, StockCheck latest, StockCheckReceipt latestReceipt, StockShortageReport latestReport,
        List<StockCheckReceipt> unappliedReceipts, LocalDate today
    ) {
        BigDecimal minimum = item.requiredMinimumOn(today);

        if (latest == null) {
            return new InventoryCountRowResponse(
                item.getId(), item.getName(), item.getCategory(), item.getUnitOfMeasurement(),
                null, minimum, InventoryCountStatus.STALE, null, null, null, null, null, null, null, null, null,
                item.getImageId()
            );
        }

        StockCheckSnapshot latestSnapshot = latest.hasSnapshot(StockCheckSnapshot.END_OF_DAY)
            ? StockCheckSnapshot.END_OF_DAY
            : StockCheckSnapshot.START_OF_DAY;
        // The latest count, plus deliveries that arrived after it and were not
        // added to any row (no row existed that day).
        BigDecimal currentStock = latest.getCurrentCount().add(StockCheckReceipt.pendingTotal(unappliedReceipts, latest));

        InventoryCountStatus status = InventoryCountStatusCalculator.calculate(latest, today, minimum);

        // Change vs. the immediately preceding count-or-delivery event -- the
        // same merge of StockCheck snapshots and receipts the Change History
        // timeline uses (countHistoryForStore below), not just a diff between
        // two StockCheck rows. A delivery recorded against no row (the common
        // case: stock arrives between formal counts) never creates a second
        // StockCheck row, so comparing rows alone left "change" stuck at "--"
        // after every such delivery even though currentStock had moved.
        List<StockCheck> recent = stockCheckRepository.findRecentForItem(item.getId(), PageRequest.of(0, 2));
        List<StockCheckReceipt> recentReceipts = stockCheckReceiptRepository.findRecentForItem(item.getId(), PageRequest.of(0, 2));
        List<CountEvent> events = new ArrayList<>();
        for (StockCheck check : recent) {
            events.addAll(countEvents(check));
        }
        for (StockCheckReceipt receipt : recentReceipts) {
            events.add(receiptEvent(receipt));
        }
        events.sort(EVENT_ORDER.reversed());

        BigDecimal change = null;
        LocalDate changeFromDate = null;
        if (events.size() > 1) {
            change = events.get(0).count().subtract(events.get(1).count());
            changeFromDate = events.get(1).date();
        }

        // Last update: the most recent count, unless a delivery came after it.
        CountEvent lastUpdate = countEvents(latest).stream().max(EVENT_ORDER).orElse(null);
        if (latestReceipt != null && (lastUpdate == null || latestReceipt.getReceivedAt().isAfter(lastUpdate.at()))) {
            lastUpdate = receiptEvent(latestReceipt);
        }
        // ...or a mid-day shortage report, which also moves the count.
        if (latestReport != null && (lastUpdate == null || latestReport.getReportedAt().isAfter(lastUpdate.at()))) {
            lastUpdate = shortageEvent(latestReport);
        }
        OffsetDateTime lastUpdatedAt = lastUpdate != null ? lastUpdate.at() : latest.getUpdatedAt();
        String lastUpdatedBy = lastUpdate != null && lastUpdate.by() != null ? lastUpdate.by() : latest.getCheckedBy().getFullName();
        InventoryCountSource lastUpdatedSource = lastUpdate != null ? lastUpdate.source() : InventoryCountSource.valueOf(latestSnapshot.name());

        return new InventoryCountRowResponse(
            item.getId(), item.getName(), item.getCategory(), item.getUnitOfMeasurement(),
            currentStock, minimum, status, lastUpdatedAt, lastUpdatedBy, lastUpdatedSource,
            change, changeFromDate,
            latest.getId(), latestSnapshot, latest.availableFor(latestSnapshot), latest.deadStockFor(latestSnapshot),
            item.getImageId()
        );
    }

    // Count-history timeline for one Inventory Counts row, newest first.
    @Transactional(readOnly = true)
    public List<InventoryCountHistoryEntryResponse> getCountHistory(Long ownerId, Long itemId) {
        Long storeId = requireActiveStoreOwner(ownerId).getStore().getId();
        return countHistoryForStore(storeId, itemId);
    }

    // Super Admin's cross-store mirror -- same storeId-direct pattern as the
    // other ForSuperAdmin methods above.
    @Transactional(readOnly = true)
    public List<InventoryCountHistoryEntryResponse> getCountHistoryForSuperAdmin(Long storeId, Long itemId) {
        return countHistoryForStore(storeId, itemId);
    }

    // One entry per Start of Day count, End of Day count and delivery, merged
    // by time. Each shows who made it and how (source); the change is against
    // the entry before it.
    private List<InventoryCountHistoryEntryResponse> countHistoryForStore(Long storeId, Long itemId) {
        StoreInventoryItem item = storeInventoryItemRepository.findByIdAndStoreId(itemId, storeId)
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));

        List<CountEvent> events = new ArrayList<>();
        for (StockCheck check : stockCheckRepository.findRecentForItem(item.getId(), PageRequest.of(0, MAX_HISTORY_ENTRIES))) {
            events.addAll(countEvents(check));
        }
        for (StockCheckReceipt receipt : stockCheckReceiptRepository.findRecentForItem(item.getId(), PageRequest.of(0, MAX_HISTORY_ENTRIES))) {
            events.add(receiptEvent(receipt));
        }
        for (StockShortageReport report : stockShortageReportRepository.findRecentForItem(item.getId(), PageRequest.of(0, MAX_HISTORY_ENTRIES))) {
            events.add(shortageEvent(report));
        }
        events.sort(EVENT_ORDER.reversed());

        // Delta is computed against the immediately older event before the
        // 7-day cutoff is applied, so the oldest entry still shown keeps a
        // correct delta even though its predecessor falls outside the window.
        LocalDate cutoff = LocalDate.now().minusDays(6);
        List<InventoryCountHistoryEntryResponse> entries = new ArrayList<>();
        for (int i = 0; i < events.size() && entries.size() < MAX_HISTORY_ENTRIES; i++) {
            CountEvent event = events.get(i);
            if (event.date().isBefore(cutoff)) continue;
            BigDecimal delta = i + 1 < events.size() ? event.count().subtract(events.get(i + 1).count()) : null;
            entries.add(new InventoryCountHistoryEntryResponse(
                event.date(), event.count(), delta, event.by(), event.at(), event.source()
            ));
        }
        return entries;
    }

    private record CountEvent(LocalDate date, BigDecimal count, String by, OffsetDateTime at, InventoryCountSource source) {
    }

    // Oldest first; entries made at the same instant keep the enum order
    // (Start of Day, End of Day, then delivery).
    private static final Comparator<CountEvent> EVENT_ORDER = Comparator
        .comparing(CountEvent::at)
        .thenComparing(CountEvent::source);

    // The Start of Day and End of Day counts a row holds, each credited to whoever
    // last saved it (falling back to who first entered it, then the row's last
    // saver) and timed at that save.
    private static List<CountEvent> countEvents(StockCheck check) {
        List<CountEvent> events = new ArrayList<>(2);
        if (check.hasSnapshot(StockCheckSnapshot.START_OF_DAY)) {
            events.add(snapshotEvent(check, InventoryCountSource.START_OF_DAY, check.usableFor(StockCheckSnapshot.START_OF_DAY),
                check.getStartOfDayCheckedBy(), check.getStartOfDayEnteredBy(), check.getStartOfDayCheckedAt()));
        }
        if (check.hasSnapshot(StockCheckSnapshot.END_OF_DAY)) {
            events.add(snapshotEvent(check, InventoryCountSource.END_OF_DAY, check.usableFor(StockCheckSnapshot.END_OF_DAY),
                check.getEndOfDayCheckedBy(), check.getEndOfDayEnteredBy(), check.getEndOfDayCheckedAt()));
        }
        return events;
    }

    private static CountEvent snapshotEvent(
        StockCheck check, InventoryCountSource source, BigDecimal usable, User checkedBy, User enteredBy, OffsetDateTime checkedAt
    ) {
        User by = checkedBy != null ? checkedBy : enteredBy != null ? enteredBy : check.getCheckedBy();
        OffsetDateTime at = checkedAt != null ? checkedAt
            : check.getUpdatedAt() != null ? check.getUpdatedAt()
            : check.getCheckDate().atStartOfDay(ZoneId.systemDefault()).toOffsetDateTime();
        return new CountEvent(check.getCheckDate(), usable, by == null ? null : by.getFullName(), at, source);
    }

    // A mid-day shortage report: the usable stock the employee said was left.
    private static CountEvent shortageEvent(StockShortageReport report) {
        return new CountEvent(
            report.getReportedAt().atZoneSameInstant(ZoneId.systemDefault()).toLocalDate(),
            report.getReportedUsable(), report.getReportedBy().getFullName(), report.getReportedAt(),
            InventoryCountSource.SHORTAGE_REPORT);
    }

    private static CountEvent receiptEvent(StockCheckReceipt receipt) {
        return new CountEvent(
            receipt.getReceivedAt().atZoneSameInstant(ZoneId.systemDefault()).toLocalDate(),
            receipt.getCountAfter(), receipt.receivedByName(), receipt.getReceivedAt(), InventoryCountSource.STOCK_RECEIVED);
    }

    // ---- Shared helpers ------------------------------------------------------

    private Map<Long, StockCheck> checksByItemId(Long storeId, LocalDate date) {
        return stockCheckRepository.findForStoreOnDate(storeId, date).stream()
            .collect(Collectors.toMap(sc -> sc.getStoreInventoryItem().getId(), Function.identity()));
    }

    private static void requireDeadStockWithinAvailable(BigDecimal available, BigDecimal deadStock) {
        if (deadStock.compareTo(available) > 0) {
            throw new InvalidStockCheckException("Dead stock cannot be more than available stock");
        }
    }

    // Writes one snapshot in place. Re-saving an existing snapshot with the same
    // figures is rejected (nothing to record); with different ones it appends an
    // audit row with the previous values first; an employee's genuine first
    // save writes none (the enterer is recorded on the check itself). A
    // correction (isCorrection) always appends an audit row, even when
    // filling in a snapshot that had no prior value -- originalCount is null
    // in that case -- and never claims "enteredBy" credit for doing so (see
    // StockCheck.recordSnapshot). Saving End of Day also persists tomorrow's
    // requirement and the resulting quantity to order.
    //
    // Exactly one of userActor/superAdminActor is non-null. StockCheck's own
    // checked-by/entered-by columns (User-only) only ever receive userActor --
    // a Super Admin correction (RTS-306) passes null there, and recordSnapshot
    // then leaves the existing checked-by values untouched (checked_by_user_id
    // is NOT NULL, so it can't be cleared). superAdminActor only ever reaches
    // the StockCheckCorrection audit row.
    private StockCheck applySnapshot(
        StockCheck check, StockCheckSnapshot snapshot, BigDecimal available, BigDecimal deadStock,
        User userActor, SuperAdmin superAdminActor, String reason, boolean isCorrection
    ) {
        boolean hadValue = check.hasSnapshot(snapshot);
        BigDecimal previousAvailable = hadValue ? check.availableFor(snapshot) : null;
        BigDecimal previousDeadStock = hadValue ? check.deadStockFor(snapshot) : null;

        // Re-saving identical figures changes nothing, so reject it rather than
        // bumping "last updated" and appending a no-op audit row.
        if (hadValue
            && previousAvailable.compareTo(available) == 0
            && (previousDeadStock == null ? BigDecimal.ZERO : previousDeadStock).compareTo(deadStock) == 0) {
            throw new InvalidStockCheckException("No changes to save - the values are the same as the current ones");
        }

        check.recordSnapshot(snapshot, available, deadStock, userActor, OffsetDateTime.now(), isCorrection);

        if (snapshot == StockCheckSnapshot.END_OF_DAY) {
            BigDecimal required = check.getStoreInventoryItem().requiredMinimumOn(check.getCheckDate().plusDays(1));
            check.setRequiredTomorrow(required);
            check.setQuantityNeeded(orderQuantity(required, check.usableFor(StockCheckSnapshot.END_OF_DAY)));
        }

        StockCheck saved = stockCheckRepository.save(check);

        if (isCorrection || hadValue) {
            StockCheckCorrection correction = new StockCheckCorrection();
            correction.setStockCheck(saved);
            correction.setSnapshot(snapshot);
            correction.setOriginalCount(previousAvailable);
            correction.setOriginalDeadStock(previousDeadStock);
            correction.setCorrectedCount(available);
            correction.setCorrectedDeadStock(deadStock);
            correction.setCorrectedByUser(userActor);
            correction.setCorrectedBySuperAdmin(superAdminActor);
            correction.setReason(reason);
            stockCheckCorrectionRepository.save(correction);
        }

        return saved;
    }

    // End of Day: a shortage against tomorrow's minimum is pushed to the order
    // list (upserted, so re-saving EOD updates it), and an EOD that clears the
    // shortage resolves any outstanding order. Start of Day: a count below
    // today's minimum reconciles the item's open order rows with the fresh
    // count (see syncStartOfDayShortage / reconcileStartOfDayShortage).
    private void syncOrderList(StockCheck check, StockCheckSnapshot snapshot, User raisedBy) {
        StoreInventoryItem item = check.getStoreInventoryItem();
        if (snapshot == StockCheckSnapshot.START_OF_DAY) {
            syncStartOfDayShortage(check, item, raisedBy);
            return;
        }
        if (check.getQuantityNeeded().signum() <= 0) {
            orderListService.resolveShortageIfPresent(item.getStore(), item);
            return;
        }
        orderListService.upsertShortage(
            item.getStore(), item, check.getQuantityNeeded(),
            null, false, raisedBy, item.getPreferredSupplier()
        );
    }

    // Only for today's row and before End of Day: once EOD is saved it settles
    // the order against tomorrow's minimum, and a past day's count (an Owner
    // correcting history) must not raise an order now.
    private void syncStartOfDayShortage(StockCheck check, StoreInventoryItem item, User raisedBy) {
        if (!check.getCheckDate().equals(LocalDate.now()) || check.hasSnapshot(StockCheckSnapshot.END_OF_DAY)) {
            return;
        }
        BigDecimal shortage = orderQuantity(item.requiredMinimumOn(check.getCheckDate()), check.getCurrentCount());
        // Nothing left at all: flag the order urgent and tell the Owner/Admin.
        boolean outOfStock = check.getCurrentCount() != null && check.getCurrentCount().signum() == 0;
        boolean newlyUrgent = orderListService.reconcileStartOfDayShortage(
            item.getStore(), item, shortage, outOfStock, raisedBy, item.getPreferredSupplier());
        if (newlyUrgent) {
            storeOwnerRepository.findByStoreIdAndActiveTrue(item.getStore().getId())
                .map(StoreOwner::getOwner)
                .ifPresent(owner -> notificationService.notifyOwnerOfStockOut(item, raisedBy, "start of day", owner));
        }
    }

    static BigDecimal orderQuantity(BigDecimal requiredTomorrow, BigDecimal endUsable) {
        if (requiredTomorrow == null || endUsable == null) {
            return BigDecimal.ZERO;
        }
        return requiredTomorrow.subtract(endUsable).max(BigDecimal.ZERO);
    }

    // Persisted at EOD save; before that, what the item's thresholds say now.
    private static BigDecimal requiredTomorrow(StoreInventoryItem item, StockCheck check, LocalDate date) {
        if (check != null && check.hasSnapshot(StockCheckSnapshot.END_OF_DAY)) {
            return check.getRequiredTomorrow();
        }
        return item.requiredMinimumOn(date.plusDays(1));
    }

    private static BigDecimal quantityToOrder(StockCheck check) {
        return check != null && check.hasSnapshot(StockCheckSnapshot.END_OF_DAY) ? check.getQuantityNeeded() : null;
    }

    private static EodSupplierReportResponse.Row toReportRow(
        StoreInventoryItem item, StockCheck check, LocalDate date, OrderListEntryResponse activeOrder, OrderListService.OrderedInfo ordered,
        boolean reconciledBySod
    ) {
        BigDecimal required = requiredTomorrow(item, check, date);
        BigDecimal toOrder = quantityToOrder(check);
        boolean shortOnThisDay = toOrder != null && toOrder.signum() > 0;

        // Today's shortage stays pending until ordered, and yesterday's can
        // still be ordered this morning; anything older is closed to changes.
        LocalDate today = LocalDate.now();
        boolean canStillOrder = date.equals(today) || date.equals(today.minusDays(1));
        boolean orderPending = canStillOrder && !reconciledBySod
            && activeOrder != null && "NEEDS_ORDERING".equals(activeOrder.status());

        // An order counts for this day when it was placed on it, or -- for a
        // shortage -- placed afterwards within the window the order service
        // allows (see orderedInfoByItemFor). Without a shortage, only an order
        // placed on the day itself is shown. On today's report a fresh Needs
        // Ordering entry (e.g. raised again after a delivery) outranks an
        // earlier order: there's something new to act on.
        boolean orderCounts = ordered != null
            && (shortOnThisDay || ordered.orderedOn().equals(date))
            && !(date.equals(today) && orderPending);
        BigDecimal orderedQuantity = orderCounts ? ordered.quantity() : null;
        LocalDate orderedOn = orderCounts ? ordered.orderedOn() : null;
        Long orderEntryId = orderPending && !orderCounts ? activeOrder.id() : null;

        EodSupplierReportResponse.Status status;
        if (toOrder == null) {
            boolean startCounted = check != null && check.hasSnapshot(StockCheckSnapshot.START_OF_DAY);
            status = check != null && check.isEndOfDaySkipped()
                ? EodSupplierReportResponse.Status.END_OF_DAY_SKIPPED
                : startCounted
                    ? EodSupplierReportResponse.Status.END_OF_DAY_PENDING
                    : EodSupplierReportResponse.Status.START_OF_DAY_PENDING;
        } else if (shortOnThisDay) {
            status = orderCounts
                ? EodSupplierReportResponse.Status.ORDERED
                : canStillOrder
                    ? EodSupplierReportResponse.Status.NEEDS_TO_ORDER
                    : EodSupplierReportResponse.Status.NOT_ORDERED;
        } else if (required == null) {
            status = EodSupplierReportResponse.Status.NO_MINIMUM_SET;
        } else {
            status = EodSupplierReportResponse.Status.SUFFICIENT;
        }

        return new EodSupplierReportResponse.Row(
            item.getId(),
            item.getName(),
            item.getUnitOfMeasurement(),
            item.getCategory(),
            item.getImageId(),
            check != null ? check.getStartOfDayAvailable() : null,
            check != null ? check.getStartOfDayDeadStock() : null,
            check != null ? check.getEndOfDayAvailable() : null,
            check != null ? check.getEndOfDayDeadStock() : null,
            check != null ? check.stockUsed() : null,
            required,
            toOrder,
            status,
            orderedQuantity,
            orderEntryId,
            orderedOn,
            check != null && check.isEndOfDaySkipped() ? check.getEndOfDaySkippedReason() : null
        );
    }
}
