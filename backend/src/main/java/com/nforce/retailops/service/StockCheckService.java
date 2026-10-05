package com.nforce.retailops.service;

import com.nforce.retailops.dto.AdHocShortageRequest;
import com.nforce.retailops.dto.DailyStockCheckItemResponse;
import com.nforce.retailops.dto.EodSupplierReportResponse;
import com.nforce.retailops.dto.InventoryCountHistoryEntryResponse;
import com.nforce.retailops.dto.InventoryCountRowResponse;
import com.nforce.retailops.dto.InventoryCountStatus;
import com.nforce.retailops.dto.InventoryCountsPageResponse;
import com.nforce.retailops.dto.StockCheckCorrectionRequest;
import com.nforce.retailops.dto.StockCheckEditResponse;
import com.nforce.retailops.dto.StockCheckHistoryPageResponse;
import com.nforce.retailops.dto.StockCheckResponse;
import com.nforce.retailops.dto.StockCheckSubmitRequest;
import com.nforce.retailops.dto.StockSnapshotResponse;
import com.nforce.retailops.dto.StoreInventoryItemOptionResponse;
import com.nforce.retailops.entity.InventoryItemCategory;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckCorrection;
import com.nforce.retailops.entity.StockCheckSnapshot;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidStockCheckException;
import com.nforce.retailops.exception.InventoryItemNotAssignedException;
import com.nforce.retailops.exception.StoreInventoryItemNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StockCheckCorrectionRepository;
import com.nforce.retailops.repository.StockCheckRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.UserRepository;
import com.nforce.retailops.util.DateRangeValidator;
import com.nforce.retailops.util.InventoryCountStatusCalculator;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
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

    // Inventory Counts row's expandable count-history timeline: how many of
    // an item's most recent StockCheck rows to show.
    private static final int MAX_HISTORY_ENTRIES = 15;

    static final String NO_SUPPLIER = "No Supplier";

    private final StoreInventoryItemRepository storeInventoryItemRepository;
    private final StockCheckRepository stockCheckRepository;
    private final StockCheckCorrectionRepository stockCheckCorrectionRepository;
    private final UserRepository userRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final OrderListService orderListService;
    private final UserProfileService userProfileService;

    public StockCheckService(
        StoreInventoryItemRepository storeInventoryItemRepository,
        StockCheckRepository stockCheckRepository,
        StockCheckCorrectionRepository stockCheckCorrectionRepository,
        UserRepository userRepository,
        StoreOwnerRepository storeOwnerRepository,
        OrderListService orderListService,
        UserProfileService userProfileService
    ) {
        this.storeInventoryItemRepository = storeInventoryItemRepository;
        this.stockCheckRepository = stockCheckRepository;
        this.stockCheckCorrectionRepository = stockCheckCorrectionRepository;
        this.userRepository = userRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.orderListService = orderListService;
        this.userProfileService = userProfileService;
    }

    // ---- Employee: today's checklist --------------------------------------

    @Transactional(readOnly = true)
    public List<DailyStockCheckItemResponse> getTodayChecklist(Long employeeUserId, Long storeId) {
        userProfileService.requireAssignedStore(employeeUserId, storeId);
        LocalDate today = LocalDate.now();
        List<StoreInventoryItem> items = storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(storeId);
        Map<Long, StockCheck> todaysChecksByItemId = checksByItemId(storeId, today);

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
                    check != null ? check.stockUsed() : null,
                    quantityToOrder(check),
                    item.getImageId()
                );
            })
            .toList();
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
                created.setCheckDate(today);
                return created;
            });

        check = applySnapshot(check, request.snapshot(), request.available(), request.deadStock(), employee, null);
        syncOrderList(check, request.snapshot(), employee);
        return StockCheckResponse.from(check);
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

        User employee = userRepository.getReferenceById(employeeUserId);
        orderListService.upsertShortage(
            storeItem.getStore(), storeItem, request.quantity(),
            request.note(), true, employee, storeItem.getPreferredSupplier()
        );
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

    @Transactional
    public StockCheckResponse correctCheck(Long ownerId, Long checkId, StockCheckCorrectionRequest request) {
        StoreOwner storeOwner = requireActiveStoreOwner(ownerId);

        StockCheck check = stockCheckRepository.findByIdAndStoreId(checkId, storeOwner.getStore().getId())
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Stock check not found"));

        requireDeadStockWithinAvailable(request.available(), request.deadStock());

        User owner = userRepository.getReferenceById(ownerId);
        check = applySnapshot(check, request.snapshot(), request.available(), request.deadStock(), owner, request.reason());

        // Only propagate to the order list for TODAY's record -- correcting a
        // stale historical entry shouldn't resurrect or distort today's live
        // order queue.
        if (check.getCheckDate().isEqual(LocalDate.now())) {
            syncOrderList(check, request.snapshot(), check.getCheckedBy());
        }

        return StockCheckResponse.from(check);
    }

    // Every active item plus any inactive one that was counted that day,
    // grouped by preferred supplier. A day without End of Day shows its
    // tomorrow's requirement from the item's current thresholds.
    @Transactional(readOnly = true)
    public EodSupplierReportResponse getEodSupplierReport(Long ownerId, LocalDate date) {
        LocalDate reportDate = date != null ? date : LocalDate.now();
        if (reportDate.isAfter(LocalDate.now())) {
            throw new InvalidStockCheckException("The report date cannot be in the future");
        }

        Long storeId = requireActiveStoreOwner(ownerId).getStore().getId();
        Map<Long, StockCheck> checksByItemId = checksByItemId(storeId, reportDate);
        List<StoreInventoryItem> items = storeInventoryItemRepository.findByStoreIdOrderById(storeId).stream()
            .filter(item -> item.isActive() || checksByItemId.containsKey(item.getId()))
            .sorted(Comparator.comparing(StoreInventoryItem::getName, String.CASE_INSENSITIVE_ORDER))
            .toList();

        Map<Long, List<EodSupplierReportResponse.Row>> rowsBySupplierId = new LinkedHashMap<>();
        Map<Long, Supplier> suppliersById = new LinkedHashMap<>();
        List<EodSupplierReportResponse.Row> noSupplierRows = new ArrayList<>();
        int needingOrder = 0;
        int pendingEod = 0;

        for (StoreInventoryItem item : items) {
            StockCheck check = checksByItemId.get(item.getId());
            EodSupplierReportResponse.Row row = toReportRow(item, check, reportDate);
            if (row.status() == EodSupplierReportResponse.Status.NEEDS_TO_ORDER) needingOrder++;
            if (row.status() == EodSupplierReportResponse.Status.END_OF_DAY_PENDING) pendingEod++;

            Supplier supplier = item.getPreferredSupplier();
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
        Long ownerId, String search, InventoryItemCategory category, String level, Integer page, Integer size
    ) {
        Long storeId = requireActiveStoreOwner(ownerId).getStore().getId();
        LocalDate today = LocalDate.now();

        List<StoreInventoryItem> items = storeInventoryItemRepository.findByStoreIdAndActiveTrueOrderById(storeId);
        Map<Long, StockCheck> latestByItemId = stockCheckRepository.findLatestPerItemForStore(storeId).stream()
            .collect(Collectors.toMap(sc -> sc.getStoreInventoryItem().getId(), Function.identity()));

        List<InventoryCountRowResponse> allRows = items.stream()
            .map(item -> toCountRow(item, latestByItemId.get(item.getId()), today))
            .toList();

        long allCount = allRows.size();
        long outCount = allRows.stream().filter(r -> r.status() == InventoryCountStatus.OUT_OF_STOCK).count();
        long lowCount = allRows.stream().filter(r -> r.status() == InventoryCountStatus.LOW).count();
        long staleCount = allRows.stream().filter(r -> r.status() == InventoryCountStatus.STALE).count();

        String needle = search == null ? "" : search.trim().toLowerCase();
        List<InventoryCountRowResponse> filtered = allRows.stream()
            .filter(r -> needle.isEmpty() || r.name().toLowerCase().contains(needle))
            .filter(r -> category == null || r.category() == category)
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

    private InventoryCountRowResponse toCountRow(StoreInventoryItem item, StockCheck latest, LocalDate today) {
        Integer minimum = item.requiredMinimumOn(today);

        if (latest == null) {
            return new InventoryCountRowResponse(
                item.getId(), item.getName(), item.getCategory(), item.getUnitOfMeasurement(),
                null, minimum, InventoryCountStatus.STALE, null, null, null, null, null, null, null, null,
                item.getImageId()
            );
        }

        StockCheckSnapshot latestSnapshot = latest.hasSnapshot(StockCheckSnapshot.END_OF_DAY)
            ? StockCheckSnapshot.END_OF_DAY
            : StockCheckSnapshot.START_OF_DAY;
        int currentStock = latest.getCurrentCount();

        InventoryCountStatus status = InventoryCountStatusCalculator.calculate(latest, today, minimum);

        Integer change = null;
        LocalDate changeFromDate = null;
        List<StockCheck> recent = stockCheckRepository.findRecentForItem(item.getId(), PageRequest.of(0, 2));
        if (recent.size() > 1) {
            StockCheck previous = recent.get(1);
            change = currentStock - previous.getCurrentCount();
            changeFromDate = previous.getCheckDate();
        }

        return new InventoryCountRowResponse(
            item.getId(), item.getName(), item.getCategory(), item.getUnitOfMeasurement(),
            currentStock, minimum, status, latest.getUpdatedAt(), latest.getCheckedBy().getFullName(),
            change, changeFromDate,
            latest.getId(), latestSnapshot, latest.availableFor(latestSnapshot), latest.deadStockFor(latestSnapshot),
            item.getImageId()
        );
    }

    // Count-history timeline for one Inventory Counts row, newest first.
    @Transactional(readOnly = true)
    public List<InventoryCountHistoryEntryResponse> getCountHistory(Long ownerId, Long itemId) {
        Long storeId = requireActiveStoreOwner(ownerId).getStore().getId();
        StoreInventoryItem item = storeInventoryItemRepository.findByIdAndStoreId(itemId, storeId)
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));

        List<StockCheck> recent = stockCheckRepository.findRecentForItem(item.getId(), PageRequest.of(0, MAX_HISTORY_ENTRIES));
        List<InventoryCountHistoryEntryResponse> entries = new ArrayList<>();
        for (int i = 0; i < recent.size(); i++) {
            StockCheck check = recent.get(i);
            Integer delta = i + 1 < recent.size() ? check.getCurrentCount() - recent.get(i + 1).getCurrentCount() : null;
            entries.add(new InventoryCountHistoryEntryResponse(
                check.getCheckDate(), check.getCurrentCount(), delta, check.getCheckedBy().getFullName(), check.getUpdatedAt()
            ));
        }
        return entries;
    }

    // ---- Shared helpers ------------------------------------------------------

    private Map<Long, StockCheck> checksByItemId(Long storeId, LocalDate date) {
        return stockCheckRepository.findForStoreOnDate(storeId, date).stream()
            .collect(Collectors.toMap(sc -> sc.getStoreInventoryItem().getId(), Function.identity()));
    }

    private static void requireDeadStockWithinAvailable(int available, int deadStock) {
        if (deadStock > available) {
            throw new InvalidStockCheckException("Dead stock cannot be more than available stock");
        }
    }

    // Writes one snapshot in place. Re-saving an existing snapshot appends an
    // audit row with the previous values first; the first save writes none
    // (the enterer is recorded on the check itself). Saving End of Day also
    // persists tomorrow's requirement and the resulting quantity to order.
    private StockCheck applySnapshot(
        StockCheck check, StockCheckSnapshot snapshot, int available, int deadStock, User by, String reason
    ) {
        boolean isEdit = check.hasSnapshot(snapshot);
        int previousAvailable = isEdit ? check.availableFor(snapshot) : 0;
        Integer previousDeadStock = isEdit ? check.deadStockFor(snapshot) : null;

        check.recordSnapshot(snapshot, available, deadStock, by, OffsetDateTime.now());

        if (snapshot == StockCheckSnapshot.END_OF_DAY) {
            Integer required = check.getStoreInventoryItem().requiredMinimumOn(check.getCheckDate().plusDays(1));
            check.setRequiredTomorrow(required);
            check.setQuantityNeeded(orderQuantity(required, check.usableFor(StockCheckSnapshot.END_OF_DAY)));
        }

        StockCheck saved = stockCheckRepository.save(check);

        if (isEdit) {
            StockCheckCorrection correction = new StockCheckCorrection();
            correction.setStockCheck(saved);
            correction.setSnapshot(snapshot);
            correction.setOriginalCount(previousAvailable);
            correction.setOriginalDeadStock(previousDeadStock);
            correction.setCorrectedCount(available);
            correction.setCorrectedDeadStock(deadStock);
            correction.setCorrectedBy(by);
            correction.setReason(reason);
            stockCheckCorrectionRepository.save(correction);
        }

        return saved;
    }

    // Only End of Day drives ordering: a shortage against tomorrow's minimum
    // is pushed to the order list (upserted, so re-saving EOD updates it), and
    // an EOD that clears the shortage resolves any outstanding order.
    private void syncOrderList(StockCheck check, StockCheckSnapshot snapshot, User raisedBy) {
        if (snapshot != StockCheckSnapshot.END_OF_DAY) {
            return;
        }
        StoreInventoryItem item = check.getStoreInventoryItem();
        // The item's own "Auto PO Generator" toggle -- off means the owner
        // reorders this item manually, so an End of Day shortfall never
        // raises or updates an order list entry for it.
        if (!item.isAutoPoEnabled()) {
            return;
        }
        if (check.getQuantityNeeded() <= 0) {
            orderListService.resolveShortageIfPresent(item.getStore(), item);
            return;
        }
        orderListService.upsertShortage(
            item.getStore(), item, check.getQuantityNeeded(),
            null, false, raisedBy, item.getPreferredSupplier()
        );
    }

    static int orderQuantity(Integer requiredTomorrow, Integer endUsable) {
        if (requiredTomorrow == null || endUsable == null) {
            return 0;
        }
        return Math.max(0, requiredTomorrow - endUsable);
    }

    // Persisted at EOD save; before that, what the item's thresholds say now.
    private static Integer requiredTomorrow(StoreInventoryItem item, StockCheck check, LocalDate date) {
        if (check != null && check.hasSnapshot(StockCheckSnapshot.END_OF_DAY)) {
            return check.getRequiredTomorrow();
        }
        return item.requiredMinimumOn(date.plusDays(1));
    }

    private static Integer quantityToOrder(StockCheck check) {
        return check != null && check.hasSnapshot(StockCheckSnapshot.END_OF_DAY) ? check.getQuantityNeeded() : null;
    }

    private static EodSupplierReportResponse.Row toReportRow(StoreInventoryItem item, StockCheck check, LocalDate date) {
        Integer required = requiredTomorrow(item, check, date);
        Integer toOrder = quantityToOrder(check);

        EodSupplierReportResponse.Status status;
        if (toOrder == null) {
            status = EodSupplierReportResponse.Status.END_OF_DAY_PENDING;
        } else if (toOrder > 0) {
            status = EodSupplierReportResponse.Status.NEEDS_TO_ORDER;
        } else if (required == null) {
            status = EodSupplierReportResponse.Status.NO_MINIMUM_SET;
        } else {
            status = EodSupplierReportResponse.Status.SUFFICIENT;
        }

        return new EodSupplierReportResponse.Row(
            item.getId(),
            item.getName(),
            item.getUnitOfMeasurement(),
            check != null ? check.getStartOfDayAvailable() : null,
            check != null ? check.getStartOfDayDeadStock() : null,
            check != null ? check.getEndOfDayAvailable() : null,
            check != null ? check.getEndOfDayDeadStock() : null,
            check != null ? check.stockUsed() : null,
            required,
            toOrder,
            status
        );
    }
}
