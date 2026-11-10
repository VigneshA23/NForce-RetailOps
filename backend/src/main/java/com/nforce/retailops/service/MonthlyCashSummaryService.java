package com.nforce.retailops.service;

import com.nforce.retailops.dto.ExpectedCashResponse;
import com.nforce.retailops.dto.MonthlyCashSummaryResponse;
import com.nforce.retailops.dto.StoreMonthlyCashSummary;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.exception.InvalidDateRangeException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Month-end cash summary (RTS-297): per-store and Combined totals of the daily
 * cash entries in one calendar month.
 *
 * <p>Every per-day figure comes from {@link CashCalculationService#calculate};
 * this class only adds those results up, so the expected-cash formula still
 * lives in exactly one place.
 */
@Service
public class MonthlyCashSummaryService {

    static final String COMBINED_LABEL = "Combined";

    private final DailyCashEntryRepository entryRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final StoreRepository storeRepository;
    private final CashCalculationService cashCalculationService;

    public MonthlyCashSummaryService(
        DailyCashEntryRepository entryRepository,
        StoreOwnerRepository storeOwnerRepository,
        StoreRepository storeRepository,
        CashCalculationService cashCalculationService
    ) {
        this.entryRepository = entryRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.storeRepository = storeRepository;
        this.cashCalculationService = cashCalculationService;
    }

    /** Owner/Admin: their own active store only (404 otherwise). */
    @Transactional(readOnly = true)
    public MonthlyCashSummaryResponse getForOwner(Long ownerId, String month) {
        YearMonth period = parseMonth(month);
        Store store = storeOwnerRepository.findByOwnerId(ownerId).stream()
            .filter(StoreOwner::isActive)
            .findFirst()
            .map(StoreOwner::getStore)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        return build(period, List.of(store));
    }

    /**
     * Super Admin: the named stores, or -- when none are named -- every active
     * store plus any inactive one that has entries in the month.
     */
    @Transactional(readOnly = true)
    public MonthlyCashSummaryResponse getForSuperAdmin(String month, List<Long> storeIds) {
        YearMonth period = parseMonth(month);
        List<Store> stores;
        if (storeIds == null || storeIds.isEmpty()) {
            Set<Long> ids = new LinkedHashSet<>();
            storeRepository.findByActiveTrueOrderByName().forEach(s -> ids.add(s.getId()));
            ids.addAll(entryRepository.findStoreIdsWithEntriesBetween(period.atDay(1), periodEnd(period)));
            stores = storeRepository.findAllById(ids);
        } else {
            Set<Long> requested = new LinkedHashSet<>(storeIds);
            stores = storeRepository.findAllById(requested);
            if (stores.size() != requested.size()) {
                throw new StoreNotFoundException("Store not found");
            }
        }
        List<Store> sorted = stores.stream()
            .sorted(Comparator.comparing(Store::getName, String.CASE_INSENSITIVE_ORDER).thenComparing(Store::getId))
            .toList();
        return build(period, sorted);
    }

    // ---------------------------------------------------------------------

    private MonthlyCashSummaryResponse build(YearMonth period, List<Store> stores) {
        LocalDate from = period.atDay(1);
        LocalDate to = periodEnd(period);

        Map<Long, List<DailyCashEntry>> entriesByStore = stores.isEmpty()
            ? Map.of()
            : entryRepository.findForStoresBetween(stores.stream().map(Store::getId).toList(), from, to)
                .stream()
                .collect(Collectors.groupingBy(e -> e.getStore().getId()));

        List<StoreMonthlyCashSummary> perStore = stores.stream()
            .map(store -> summarize(store, entriesByStore.getOrDefault(store.getId(), List.of())))
            .toList();

        return new MonthlyCashSummaryResponse(period.toString(), from, to, perStore, combine(perStore));
    }

    private StoreMonthlyCashSummary summarize(Store store, List<DailyCashEntry> entries) {
        if (entries.isEmpty()) {
            return StoreMonthlyCashSummary.empty(store.getId(), store.getName(), store.getStoreCode());
        }
        List<ExpectedCashResponse> days = entries.stream()
            .sorted(Comparator.comparing(DailyCashEntry::getBusinessDate))
            .map(cashCalculationService::calculate)
            .toList();
        ExpectedCashResponse monthEnd = days.get(days.size() - 1);

        return new StoreMonthlyCashSummary(
            store.getId(),
            store.getName(),
            store.getStoreCode(),
            days.size(),
            monthEnd.asOfDate(),
            sum(days, ExpectedCashResponse::totalCashSales),
            sum(days, ExpectedCashResponse::cashRemoved),
            sum(days, ExpectedCashResponse::bankDeposits),
            sum(days, ExpectedCashResponse::cashExpenses),
            sum(days, ExpectedCashResponse::otherAdjustments),
            monthEnd.expectedCashOnHand(),
            monthEnd.cashRemaining(),
            monthEnd.variance(),
            sum(days, ExpectedCashResponse::variance)
        );
    }

    // Combined = the column-wise sum of every store that recorded at least one
    // day; stores with no entries contribute nothing rather than a zero.
    static StoreMonthlyCashSummary combine(List<StoreMonthlyCashSummary> stores) {
        List<StoreMonthlyCashSummary> withData = stores.stream().filter(s -> s.daysRecorded() > 0).toList();
        if (withData.isEmpty()) {
            return StoreMonthlyCashSummary.empty(null, COMBINED_LABEL, null);
        }
        LocalDate latest = withData.stream().map(StoreMonthlyCashSummary::asOfDate)
            .filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
        return new StoreMonthlyCashSummary(
            null,
            COMBINED_LABEL,
            null,
            withData.stream().mapToInt(StoreMonthlyCashSummary::daysRecorded).sum(),
            latest,
            sum(withData, StoreMonthlyCashSummary::totalCashSales),
            sum(withData, StoreMonthlyCashSummary::totalCashRemoved),
            sum(withData, StoreMonthlyCashSummary::bankDeposits),
            sum(withData, StoreMonthlyCashSummary::cashExpenses),
            sum(withData, StoreMonthlyCashSummary::adjustments),
            sum(withData, StoreMonthlyCashSummary::expectedCashOnHand),
            sum(withData, StoreMonthlyCashSummary::actualCashCount),
            sum(withData, StoreMonthlyCashSummary::variance),
            sum(withData, StoreMonthlyCashSummary::netDailyVariance)
        );
    }

    private static <T> BigDecimal sum(List<T> rows, Function<T, BigDecimal> field) {
        return rows.stream().map(field).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // Null/blank means the current month. A future month has nothing to sum.
    static YearMonth parseMonth(String raw) {
        YearMonth current = YearMonth.now();
        if (raw == null || raw.isBlank()) {
            return current;
        }
        YearMonth parsed;
        try {
            parsed = YearMonth.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw new InvalidDateRangeException("Month must be in YYYY-MM format");
        }
        if (parsed.isAfter(current)) {
            throw new InvalidDateRangeException("Month cannot be in the future");
        }
        return parsed;
    }

    // The current month is reported up to today; past months to their last day.
    private static LocalDate periodEnd(YearMonth period) {
        LocalDate today = LocalDate.now();
        LocalDate monthEnd = period.atEndOfMonth();
        return monthEnd.isAfter(today) ? today : monthEnd;
    }
}
