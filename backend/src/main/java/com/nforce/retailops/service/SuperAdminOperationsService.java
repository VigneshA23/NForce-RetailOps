package com.nforce.retailops.service;

import com.nforce.retailops.dto.CreateOrderListEntryRequest;
import com.nforce.retailops.dto.OrderListEntryResponse;
import com.nforce.retailops.dto.OutstandingOrdersOverviewResponse;
import com.nforce.retailops.dto.PlatformStatsResponse;
import com.nforce.retailops.dto.StoreOperationsSummaryResponse;
import com.nforce.retailops.dto.StoreOutstandingOrdersRow;
import com.nforce.retailops.dto.StoreSupplierPurchaseMetricResponse;
import com.nforce.retailops.dto.TrendDataPoint;
import com.nforce.retailops.entity.MakeupLinkStatus;
import com.nforce.retailops.entity.OrderStatus;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Task;
import com.nforce.retailops.entity.TaskMakeupLink;
import com.nforce.retailops.entity.TaskResponseEntry;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.RaisedIssueRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.TaskMakeupLinkRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import com.nforce.retailops.util.DateRangeValidator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class SuperAdminOperationsService {

    // A moved instance's pastDate can lag its linkedDate by at most
    // TaskMakeupLinkService.MAX_LOOKBACK_DAYS (7) + MAX_MOVE_DAYS_AHEAD (7) -- widening
    // the response lookup window by this much guarantees computeTrend's per-day pastDate
    // lookups never fall outside the fetched range, even for a linkedDate right at the
    // start of the requested window.
    private static final int MAX_MOVE_LOOKBACK_PADDING_DAYS = 14;

    // Row cap for the outstanding-orders table. Deliberately its own constant and
    // NOT shared with ChecklistHistoryService.MAX_STORE_SELECTION: that one is
    // private there and means something different -- a limit on request input that
    // throws when exceeded, rather than a silent cap on response rows. Coupling
    // them would let a change to one quietly break the other's contract.
    private static final int MAX_OUTSTANDING_ROWS = 50;

    // Matches OrderListService's own cap for its (store-scoped) version of
    // this same report.
    private static final int MAX_DATE_RANGE_DAYS = 92;

    static final String NO_SUPPLIER = "No Supplier";

    private final StoreOwnerRepository storeOwnerRepository;
    private final TaskRepository taskRepository;
    private final TaskResponseEntryRepository taskResponseEntryRepository;
    private final TaskMakeupLinkRepository taskMakeupLinkRepository;
    private final RaisedIssueRepository raisedIssueRepository;
    private final StoreEmployeeRepository storeEmployeeRepository;
    private final OrderListEntryRepository orderListEntryRepository;
    private final OrderListService orderListService;

    public SuperAdminOperationsService(
        StoreOwnerRepository storeOwnerRepository,
        TaskRepository taskRepository,
        TaskResponseEntryRepository taskResponseEntryRepository,
        TaskMakeupLinkRepository taskMakeupLinkRepository,
        RaisedIssueRepository raisedIssueRepository,
        StoreEmployeeRepository storeEmployeeRepository,
        OrderListEntryRepository orderListEntryRepository,
        OrderListService orderListService
    ) {
        this.storeOwnerRepository = storeOwnerRepository;
        this.taskRepository = taskRepository;
        this.taskResponseEntryRepository = taskResponseEntryRepository;
        this.taskMakeupLinkRepository = taskMakeupLinkRepository;
        this.raisedIssueRepository = raisedIssueRepository;
        this.storeEmployeeRepository = storeEmployeeRepository;
        this.orderListEntryRepository = orderListEntryRepository;
        this.orderListService = orderListService;
    }

    // Super Admin's per-store order-list drill-down from the outstanding-orders
    // overview above, and the status-update action on it. Both simply delegate to
    // OrderListService so the NEEDS_ORDERING -> ORDERED -> RECEIVED transition rule
    // (ALLOWED_TRANSITIONS) stays defined in exactly one place for both roles.
    @Transactional(readOnly = true)
    public List<OrderListEntryResponse> getOrderListForStore(Long storeId) {
        return orderListService.listForStore(storeId);
    }

    @Transactional
    public OrderListEntryResponse updateOrderStatus(Long storeId, Long entryId, OrderStatus status, OrderStatus expectedStatus) {
        return orderListService.updateStatusForSuperAdmin(storeId, entryId, status, expectedStatus);
    }

    @Transactional
    public OrderListEntryResponse createOrderListEntry(Long storeId, CreateOrderListEntryRequest request) {
        return orderListService.createEntryForSuperAdmin(storeId, request);
    }

    // Platform-wide "what still needs ordering", in a single grouped query -- never
    // a per-store loop, which would be an N+1 that grows with the platform.
    //
    // Stores with nothing outstanding are absent by construction (see the repository
    // query's where clause). Stores with no active owner are deliberately present:
    // an ownerless store accumulating shortages is exactly what a Super Admin needs
    // to see. There is also no store.active filter -- an entry at a deactivated
    // store is still an outstanding order, and dropping those stores would break the
    // invariant that platformOutstandingCount equals the sum of every group.
    @Transactional(readOnly = true)
    public OutstandingOrdersOverviewResponse getOutstandingOrdersOverview() {
        List<Object[]> rows = orderListEntryRepository
            .findOutstandingRowsGroupedByStore(OrderStatus.NEEDS_ORDERING);

        long platformOutstandingCount = 0;
        List<StoreOutstandingOrdersRow> stores = new ArrayList<>(Math.min(rows.size(), MAX_OUTSTANDING_ROWS));

        for (Object[] row : rows) {
            long outstandingCount = (Long) row[4];
            // Accumulated for EVERY group, including those past the cap. This is the
            // whole reason the total is derived here rather than from `stores` --
            // truncating the list must not move the number.
            platformOutstandingCount += outstandingCount;

            if (stores.size() < MAX_OUTSTANDING_ROWS) {
                String ownerName = (String) row[3];
                stores.add(new StoreOutstandingOrdersRow(
                    (Long) row[0],
                    (Long) row[1],
                    (String) row[2],
                    ownerName != null ? ownerName : "Unassigned",
                    outstandingCount,
                    (OffsetDateTime) row[5]
                ));
            }
        }

        return new OutstandingOrdersOverviewResponse(
            platformOutstandingCount, rows.size(), rows.size() > MAX_OUTSTANDING_ROWS, stores);
    }

    // Super Admin's cross-store Supplier Purchasing Summary. Deliberately a
    // separate query from getOutstandingOrdersOverview above: that one is
    // locked to NEEDS_ORDERING for a different feature (what still needs
    // ordering right now) and must not change behavior for this one (what was
    // actually purchased, ORDERED/RECEIVED, in a date range). COUNT/SUM/GROUP
    // BY all happen in findSupplierMetricsGroupedByStore, not here.
    @Transactional(readOnly = true)
    public List<StoreSupplierPurchaseMetricResponse> getSupplierPurchaseMetrics(LocalDate fromDate, LocalDate toDate) {
        DateRangeValidator.validate(fromDate, toDate, MAX_DATE_RANGE_DAYS);

        List<Object[]> rows = orderListEntryRepository.findSupplierMetricsGroupedByStore(
            OrderStatus.PURCHASED_STATUSES, OrderListService.rangeStart(fromDate), OrderListService.rangeEndExclusive(toDate));

        return rows.stream()
            .map(row -> new StoreSupplierPurchaseMetricResponse(
                ((Number) row[0]).longValue(),
                (String) row[1],
                row[3] != null ? (String) row[3] : NO_SUPPLIER,
                ((Number) row[4]).longValue(),
                OrderListService.toDecimal(row[5])
            ))
            .sorted(Comparator.comparing(StoreSupplierPurchaseMetricResponse::storeName, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(StoreSupplierPurchaseMetricResponse::supplierName, String.CASE_INSENSITIVE_ORDER))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<StoreOperationsSummaryResponse> getOperationsOverview(LocalDate date) {
        List<StoreOwner> activeLinks = storeOwnerRepository.findAllWithStoreAndOwner().stream()
            .filter(so -> so.isActive() && so.getOwner() != null)
            .toList();

        return activeLinks.stream()
            .map(link -> buildStoreSummary(link, date))
            .sorted(Comparator.comparingInt(StoreOperationsSummaryResponse::completionPercent))
            .toList();
    }

    @Transactional(readOnly = true)
    public PlatformStatsResponse getPlatformStats(LocalDate date) {
        List<StoreOwner> activeLinks = storeOwnerRepository.findAllWithStoreAndOwner().stream()
            .filter(so -> so.isActive() && so.getOwner() != null)
            .toList();

        int totalStores = activeLinks.size();
        int totalTasks = 0;
        int completedTasks = 0;
        long totalOpenIssues = 0;
        int storesWithActivity = 0;
        int storesWithOpenIssues = 0;
        Set<Long> employeesActiveToday = new HashSet<>();
        Set<Long> distinctOwnerIds = new HashSet<>();
        Set<Long> ownersLoggedInToday = new HashSet<>();

        for (StoreOwner link : activeLinks) {
            long storeId = link.getStore().getId();
            long ownerId = link.getOwner().getId();
            distinctOwnerIds.add(ownerId);
            OffsetDateTime lastLoginAt = link.getOwner().getLastLoginAt();
            if (lastLoginAt != null && lastLoginAt.toLocalDate().equals(date)) {
                ownersLoggedInToday.add(ownerId);
            }

            DailyTaskCounts counts = computeStoreDailyCounts(ownerId, storeId, date);

            totalTasks += counts.total();
            completedTasks += counts.completed();

            if (!counts.countedResponses().isEmpty()) storesWithActivity++;

            counts.countedResponses().forEach(r -> employeesActiveToday.add(r.getEmployee().getId()));

            long openIssuesForStore = raisedIssueRepository.countByStoreIdAndStatus(storeId, "OPEN");
            totalOpenIssues += openIssuesForStore;
            if (openIssuesForStore > 0) storesWithOpenIssues++;
        }

        int platformPercent = totalTasks == 0 ? 0 : Math.round((completedTasks * 100f) / totalTasks);
        int totalEmployees = (int) storeEmployeeRepository.countByEmployeeActiveTrue();
        return new PlatformStatsResponse(
            platformPercent, totalOpenIssues, totalStores, storesWithActivity,
            totalTasks, completedTasks, totalEmployees, employeesActiveToday.size(), storesWithOpenIssues,
            distinctOwnerIds.size(), ownersLoggedInToday.size()
        );
    }

    @Transactional(readOnly = true)
    public List<TrendDataPoint> getPlatformTrend(int days) {
        int cappedDays = Math.min(Math.max(days, 1), 90);
        LocalDate today = LocalDate.now();
        LocalDate startDate = today.minusDays(cappedDays - 1);

        List<StoreOwner> activeLinks = storeOwnerRepository.findAllWithStoreAndOwner().stream()
            .filter(so -> so.isActive() && so.getOwner() != null)
            .toList();

        if (activeLinks.isEmpty()) {
            return buildEmptyTrend(startDate, today);
        }
        return computeTrend(activeLinks, startDate, today);
    }

    @Transactional(readOnly = true)
    public List<TrendDataPoint> getStoreTrend(long storeId, int days) {
        int cappedDays = Math.min(Math.max(days, 1), 90);
        LocalDate today = LocalDate.now();
        LocalDate startDate = today.minusDays(cappedDays - 1);

        List<StoreOwner> links = storeOwnerRepository.findAllWithStoreAndOwner().stream()
            .filter(so -> so.getStore().getId() == storeId && so.getOwner() != null)
            .toList();

        if (links.isEmpty()) {
            return buildEmptyTrend(startDate, today);
        }
        return computeTrend(links, startDate, today);
    }

    private List<TrendDataPoint> computeTrend(List<StoreOwner> links, LocalDate startDate, LocalDate today) {
        // Per-store task lists, one query per unique store
        Map<Long, List<Task>> tasksByStore = new HashMap<>();
        for (StoreOwner link : links) {
            Long sid = link.getStore().getId();
            if (!tasksByStore.containsKey(sid)) {
                tasksByStore.put(sid,
                    taskRepository.findActiveForStoresAndDateRange(
                        link.getOwner().getId(), List.of(sid), startDate, today
                    )
                );
            }
        }

        // One round-trip for all response tuples (date, storeId, taskId). Widened past
        // startDate by MAX_MOVE_LOOKBACK_PADDING_DAYS so a moved unit's original due date
        // (looked up below) is always covered, even for a move landing right at the start
        // of the requested window.
        List<Long> allStoreIds = links.stream().map(so -> so.getStore().getId()).distinct().toList();
        List<Object[]> tuples = taskResponseEntryRepository.findDateStoreTaskIdTuples(
            allStoreIds, startDate.minusDays(MAX_MOVE_LOOKBACK_PADDING_DAYS), today);

        // Group: Map<date, Map<storeId, Set<taskId>>>
        Map<LocalDate, Map<Long, Set<Long>>> respondedByDateAndStore = new HashMap<>();
        for (Object[] row : tuples) {
            LocalDate date = (LocalDate) row[0];
            Long sid = (Long) row[1];
            Long tid = (Long) row[2];
            respondedByDateAndStore
                .computeIfAbsent(date, k -> new HashMap<>())
                .computeIfAbsent(sid, k -> new HashSet<>())
                .add(tid);
        }

        // Missed tasks moved onto a day in this range (see TaskMakeupLinkService) --
        // folded in below the same way computeStoreDailyCounts does for a single day, so
        // a moved-and-completed task's TaskResponseEntry (stamped with its ORIGINAL due
        // date, not the day it was actually completed) attributes to the right day here too.
        List<TaskMakeupLink> movedLinks = taskMakeupLinkRepository.findByStoreIdInAndLinkedDateBetweenAndStatusIn(
            allStoreIds, startDate, today, List.of(MakeupLinkStatus.PENDING, MakeupLinkStatus.FULFILLED));
        Map<LocalDate, Map<Long, List<TaskMakeupLink>>> movedByDateAndStore = new HashMap<>();
        for (TaskMakeupLink moved : movedLinks) {
            movedByDateAndStore
                .computeIfAbsent(moved.getLinkedDate(), k -> new HashMap<>())
                .computeIfAbsent(moved.getStore().getId(), k -> new ArrayList<>())
                .add(moved);
        }

        List<TrendDataPoint> points = new ArrayList<>();
        for (LocalDate d = startDate; !d.isAfter(today); d = d.plusDays(1)) {
            int totalUnion = 0;
            int totalCompleted = 0;
            final LocalDate date = d;

            for (StoreOwner link : links) {
                Long sid = link.getStore().getId();
                List<Task> storeTasks = tasksByStore.getOrDefault(sid, List.of());

                Set<Long> eligibleIds = storeTasks.stream()
                    .filter(t -> !t.getStartDate().isAfter(date)
                        && (t.getEndDate() == null || !t.getEndDate().isBefore(date))
                        && TaskScheduleMatcher.matches(t, date))
                    .map(Task::getId)
                    .collect(Collectors.toSet());

                Set<Long> respondedIds = respondedByDateAndStore
                    .getOrDefault(date, Map.of())
                    .getOrDefault(sid, Set.of());

                Set<Long> union = new HashSet<>(eligibleIds);
                union.addAll(respondedIds);

                totalUnion += union.size();
                totalCompleted += respondedIds.size();

                List<TaskMakeupLink> movedForStore = movedByDateAndStore
                    .getOrDefault(date, Map.of())
                    .getOrDefault(sid, List.of());
                for (TaskMakeupLink moved : movedForStore) {
                    boolean completed = respondedByDateAndStore
                        .getOrDefault(moved.getPastDate(), Map.of())
                        .getOrDefault(sid, Set.of())
                        .contains(moved.getTask().getId());
                    // A FULFILLED move whose response has since been undone is no longer
                    // a live instance on this date -- exclude it entirely (see
                    // computeStoreDailyCounts).
                    if (moved.getStatus() == MakeupLinkStatus.FULFILLED && !completed) {
                        continue;
                    }
                    totalUnion++;
                    if (completed) totalCompleted++;
                }
            }

            int percent = totalUnion == 0 ? 0 : Math.round((totalCompleted * 100f) / totalUnion);
            points.add(new TrendDataPoint(date.toString(), percent));
        }

        return points;
    }

    private List<TrendDataPoint> buildEmptyTrend(LocalDate startDate, LocalDate today) {
        List<TrendDataPoint> points = new ArrayList<>();
        for (LocalDate d = startDate; !d.isAfter(today); d = d.plusDays(1)) {
            points.add(new TrendDataPoint(d.toString(), 0));
        }
        return points;
    }

    private StoreOperationsSummaryResponse buildStoreSummary(StoreOwner link, LocalDate date) {
        long storeId = link.getStore().getId();
        long ownerId = link.getOwner().getId();

        DailyTaskCounts counts = computeStoreDailyCounts(ownerId, storeId, date);

        int total = counts.total();
        int completed = counts.completed();
        int percent = total == 0 ? 0 : Math.round((completed * 100f) / total);

        long openIssues = raisedIssueRepository.countByStoreIdAndStatus(storeId, "OPEN");

        // Includes moved-and-completed responses (see computeStoreDailyCounts) -- their
        // createdAt is the real completion timestamp even though their stored
        // responseDate is the original missed day, not `date`.
        OffsetDateTime lastActivity = counts.countedResponses().stream()
            .map(TaskResponseEntry::getCreatedAt)
            .max(Comparator.naturalOrder())
            .orElse(null);

        return new StoreOperationsSummaryResponse(
            storeId,
            link.getStore().getName(),
            link.getStore().getStoreCode(),
            link.getStore().getLocation(),
            link.getOwner().getFullName(),
            link.getOwner().getAvatarUrl(),
            total,
            completed,
            percent,
            openIssues,
            lastActivity
        );
    }

    // Shared by getPlatformStats and buildStoreSummary: "total tasks" / "completed
    // tasks" for one store on one date, including missed tasks the employee moved onto
    // this date (see TaskMakeupLinkService). A moved-and-completed task's
    // TaskResponseEntry.responseDate is stamped with its ORIGINAL due date, not `date`
    // (TaskService.submitResponse) -- that's the correct value for the response's own
    // identity/history, but it means a plain "responseDate == date" query alone silently
    // drops it from today's count and (if that original date is ever queried) double-
    // attributes it there instead. Folding in TaskMakeupLinkService's moved-units lookup
    // here mirrors how TaskService.getTodayChecklistForEmployee already renders a moved
    // unit as its own item on the target day's checklist.
    private DailyTaskCounts computeStoreDailyCounts(long ownerId, long storeId, LocalDate date) {
        List<Task> eligible = taskRepository.findActiveForStoreAndDate(ownerId, storeId, date).stream()
            .filter(t -> TaskScheduleMatcher.matches(t, date))
            .toList();

        List<TaskResponseEntry> responses = taskResponseEntryRepository
            .findByStoreIdAndResponseDateAndActiveTrue(storeId, date);

        Set<Long> respondedIds = responses.stream()
            .map(r -> r.getTask().getId())
            .collect(Collectors.toSet());

        Set<Long> unionIds = eligible.stream().map(Task::getId).collect(Collectors.toSet());
        unionIds.addAll(respondedIds);

        List<TaskMakeupLink> movedUnits = taskMakeupLinkRepository.findByStoreIdAndLinkedDateAndStatusIn(
            storeId, date, List.of(MakeupLinkStatus.PENDING, MakeupLinkStatus.FULFILLED));

        List<TaskResponseEntry> countedResponses = new ArrayList<>(responses);
        int movedTotal = 0;
        int movedCompleted = 0;
        if (!movedUnits.isEmpty()) {
            List<Long> movedTaskIds = movedUnits.stream().map(l -> l.getTask().getId()).distinct().toList();
            List<LocalDate> movedPastDates = movedUnits.stream().map(TaskMakeupLink::getPastDate).distinct().toList();
            Map<TaskMakeupKey, List<TaskResponseEntry>> movedResponsesByKey = taskResponseEntryRepository
                .findByStoreIdAndTaskIdInAndResponseDateInAndActiveTrue(storeId, movedTaskIds, movedPastDates).stream()
                .collect(Collectors.groupingBy(e -> new TaskMakeupKey(e.getTask().getId(), e.getResponseDate())));

            for (TaskMakeupLink moved : movedUnits) {
                List<TaskResponseEntry> movedResponses = movedResponsesByKey.getOrDefault(
                    new TaskMakeupKey(moved.getTask().getId(), moved.getPastDate()), List.of());
                // A FULFILLED move whose response has since been undone has no active
                // response left -- no longer a live instance on this date (it's back in
                // the missed list instead), so exclude it entirely rather than counting a
                // phantom task (mirrors TaskService.getTodayChecklistForEmployee).
                if (moved.getStatus() == MakeupLinkStatus.FULFILLED && movedResponses.isEmpty()) {
                    continue;
                }
                movedTotal++;
                if (!movedResponses.isEmpty()) {
                    movedCompleted++;
                    countedResponses.addAll(movedResponses);
                }
            }
        }

        return new DailyTaskCounts(unionIds.size() + movedTotal, respondedIds.size() + movedCompleted, countedResponses);
    }

    private record DailyTaskCounts(int total, int completed, List<TaskResponseEntry> countedResponses) {
    }

    private record TaskMakeupKey(Long taskId, LocalDate date) {
    }
}
