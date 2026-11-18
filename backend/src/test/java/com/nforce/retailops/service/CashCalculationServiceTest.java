package com.nforce.retailops.service;

import com.nforce.retailops.dto.ExpectedCashResponse;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CashCalculationServiceTest {

    private static final Long STORE_ID = 7L;

    @Mock DailyCashEntryRepository entryRepository;
    @Mock StoreOwnerRepository storeOwnerRepository;
    @Mock StoreRepository storeRepository;

    CashCalculationService service;
    Store store;

    @BeforeEach
    void setUp() {
        service = new CashCalculationService(entryRepository, storeOwnerRepository, storeRepository);
        store = new Store();
        ReflectionTestUtils.setField(store, "id", STORE_ID);
    }

    private DailyCashEntry entry(String date, String opening, String removed, String remaining,
                                 String expenses, String adjust) {
        DailyCashEntry e = new DailyCashEntry();
        e.setStore(store);
        e.setBusinessDate(LocalDate.parse(date));
        e.setOpeningDrawerCash(new BigDecimal(opening));
        e.setCashRemoved(new BigDecimal(removed));
        e.setCashRemaining(new BigDecimal(remaining));
        e.setCashExpenses(new BigDecimal(expenses));
        e.setOtherAdjustments(new BigDecimal(adjust));
        return e;
    }

    private static void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " but was " + actual);
    }

    // ---- the formula --------------------------------------------------------

    @Test
    void formula_appliesEveryTerm() {
        // 200 - 50 - 100 + 25 = 75
        DailyCashEntry e = entry("2026-11-09", "200", "100", "75", "50", "25");
        assertMoney("75.00", service.calculateExpectedCash(e));
    }

    @Test
    void formula_negativeOtherAdjustmentReducesExpectedCash() {
        // 200 - 50 - 100 + (-10) = 40
        DailyCashEntry e = entry("2026-11-09", "200", "100", "40", "50", "-10");
        assertMoney("40.00", service.calculateExpectedCash(e));
    }

    @Test
    void formula_canGoNegative_whenOutflowsExceedCash() {
        // 0 - 0 - 50 + 0 = -50
        DailyCashEntry e = entry("2026-11-09", "0", "50", "0", "0", "0");
        assertMoney("-50.00", service.calculateExpectedCash(e));
    }

    @Test
    void formula_ignoresCashRemaining() {
        DailyCashEntry a = entry("2026-11-09", "100", "0", "0", "0", "0");
        DailyCashEntry b = entry("2026-11-09", "100", "0", "9999", "0", "0");
        assertMoney("100.00", service.calculateExpectedCash(a));
        assertMoney("100.00", service.calculateExpectedCash(b));
    }

    // ---- variance -----------------------------------------------------------

    @Test
    void variance_shortage_isNegative() {
        // expected 75, counted 60 -> -15
        ExpectedCashResponse r = service.calculate(
            entry("2026-11-09", "200", "100", "60", "50", "25"));
        assertMoney("75.00", r.expectedCashOnHand());
        assertMoney("60.00", r.cashRemaining());
        assertMoney("-15.00", r.variance());
    }

    @Test
    void variance_overage_isPositive() {
        ExpectedCashResponse r = service.calculate(
            entry("2026-11-09", "200", "100", "100", "50", "25"));
        assertMoney("25.00", r.variance());
    }

    @Test
    void variance_exactMatch_isZero() {
        ExpectedCashResponse r = service.calculate(
            entry("2026-11-09", "200", "100", "75", "50", "25"));
        assertMoney("0.00", r.variance());
    }

    // The "live" lookup: latest entry on or before today (RTS-471).
    private Optional<DailyCashEntry> latestOnOrBeforeToday() {
        return entryRepository.findFirstByStoreIdAndBusinessDateLessThanEqualOrderByBusinessDateDesc(
            STORE_ID, LocalDate.now());
    }

    // Behaves like the real repository query over a fixed set of rows.
    private void storeHoldsEntries(DailyCashEntry... rows) {
        when(entryRepository.findFirstByStoreIdAndBusinessDateLessThanEqualOrderByBusinessDateDesc(
            eq(STORE_ID), any(LocalDate.class))).thenAnswer(inv -> {
                LocalDate asOf = inv.getArgument(1);
                return Stream.of(rows)
                    .filter(e -> !e.getBusinessDate().isAfter(asOf))
                    .max(java.util.Comparator.comparing(DailyCashEntry::getBusinessDate));
            });
    }

    // ---- store lookup -------------------------------------------------------

    @Test
    void liveLookup_isCappedAtToday() {
        when(latestOnOrBeforeToday()).thenReturn(Optional.empty());
        service.getExpectedCashForStore(STORE_ID);
        verify(entryRepository).findFirstByStoreIdAndBusinessDateLessThanEqualOrderByBusinessDateDesc(
            STORE_ID, LocalDate.now());
    }

    @Test
    void futureDatedEntry_isNeverTheLiveFigure_theLatestRealDayIs() {
        // RTS-471: a row planted far in the future (e.g. before the request
        // validation existed) must not mask the real current figure.
        LocalDate today = LocalDate.now();
        storeHoldsEntries(
            entry(today.minusDays(2).toString(), "200", "100", "75", "50", "25"),
            entry(today.plusYears(5).toString(), "0", "0", "0", "0", "0"));
        ExpectedCashResponse r = service.getExpectedCashForStore(STORE_ID);
        assertTrue(r.available());
        assertEquals(today.minusDays(2), r.asOfDate());
        assertMoney("75.00", r.expectedCashOnHand());
    }

    @Test
    void onlyFutureDatedEntries_isNotAvailable() {
        storeHoldsEntries(entry(LocalDate.now().plusDays(30).toString(), "200", "100", "75", "50", "25"));
        ExpectedCashResponse r = service.getExpectedCashForStore(STORE_ID);
        assertFalse(r.available());
        assertNull(r.asOfDate());
    }

    @Test
    void anEntryDatedToday_isLive() {
        LocalDate today = LocalDate.now();
        storeHoldsEntries(entry(today.toString(), "200", "100", "75", "50", "25"));
        assertEquals(today, service.getExpectedCashForStore(STORE_ID).asOfDate());
    }

    @Test
    void noEntries_isNotAvailable_notZero() {
        when(latestOnOrBeforeToday()).thenReturn(Optional.empty());
        ExpectedCashResponse r = service.getExpectedCashForStore(STORE_ID);
        assertFalse(r.available());
        assertEquals(STORE_ID, r.storeId());
        assertNotNull(r.message());
        assertNull(r.expectedCashOnHand());
        assertNull(r.variance());
        assertNull(r.asOfDate());
        assertNull(r.lastUpdatedAt());
    }

    @Test
    void lastUpdatedAt_isWhenTheLatestEntryWasLastSaved() {
        DailyCashEntry e = entry("2026-11-09", "200", "100", "75", "50", "25");
        OffsetDateTime savedAt = OffsetDateTime.parse("2026-11-09T21:15:00+05:30");
        e.setUpdatedAt(savedAt);
        ExpectedCashResponse r = service.calculate(e);
        assertEquals(savedAt, r.lastUpdatedAt());
        assertEquals(LocalDate.parse("2026-11-09"), r.asOfDate());
    }

    @Test
    void singleEntry_usesThatDay_andReportsAsOfDate() {
        when(latestOnOrBeforeToday()).thenReturn(Optional.of(
            entry("2026-11-09", "200", "100", "75", "50", "25")));
        ExpectedCashResponse r = service.getExpectedCashForStore(STORE_ID);
        assertTrue(r.available());
        assertEquals(LocalDate.of(2026, 11, 9), r.asOfDate());
        assertMoney("75.00", r.expectedCashOnHand());
    }

    @Test
    void oldEntry_isStillShownAsLive_withLastUpdatedAt() {
        // BA decision: no staleness cutoff. A 6-day-old entry is still the live figure.
        DailyCashEntry old = entry("2020-01-01", "200", "100", "75", "50", "25");
        java.time.OffsetDateTime saved = java.time.OffsetDateTime.parse("2020-01-01T21:30:00Z");
        ReflectionTestUtils.setField(old, "updatedAt", saved);
        when(latestOnOrBeforeToday()).thenReturn(Optional.of(old));
        ExpectedCashResponse r = service.getExpectedCashForStore(STORE_ID);
        assertTrue(r.available());
        assertEquals(saved, r.lastUpdatedAt());
        assertMoney("75.00", r.expectedCashOnHand());
    }

    @Test
    void noEntries_hasNoLastUpdatedAt() {
        when(latestOnOrBeforeToday()).thenReturn(Optional.empty());
        assertNull(service.getExpectedCashForStore(STORE_ID).lastUpdatedAt());
    }

    @Test
    void multipleDays_figureComesFromTheLatestEntryOnly_notARunningSum() {
        // The repository hands back only the latest day; earlier days must not
        // be added in (each day's opening cash already carries them forward).
        when(latestOnOrBeforeToday()).thenReturn(Optional.of(
            entry("2026-11-09", "400", "0", "355", "50", "5")));
        ExpectedCashResponse r = service.getExpectedCashForStore(STORE_ID);
        assertMoney("355.00", r.expectedCashOnHand()); // 400 - 50 + 5
        assertMoney("0.00", r.variance());
        verify(entryRepository, never()).findAll();
    }

    // ---- authorization ------------------------------------------------------

    @Test
    void owner_withActiveStore_getsOwnStore() {
        StoreOwner so = new StoreOwner();
        so.setStore(store);
        so.setActive(true);
        when(storeOwnerRepository.findByOwnerId(1L)).thenReturn(List.of(so));
        when(latestOnOrBeforeToday()).thenReturn(Optional.empty());
        assertEquals(STORE_ID, service.getExpectedCashForOwner(1L).storeId());
    }

    @Test
    void owner_withoutActiveStore_getsNotFound_andNoCashDataIsRead() {
        StoreOwner inactive = new StoreOwner();
        inactive.setStore(store);
        inactive.setActive(false);
        when(storeOwnerRepository.findByOwnerId(2L)).thenReturn(List.of(inactive));
        assertThrows(StoreNotFoundException.class, () -> service.getExpectedCashForOwner(2L));
        verifyNoInteractions(entryRepository);
    }

    @Test
    void superAdmin_unknownStore_getsNotFound() {
        when(storeRepository.existsById(STORE_ID)).thenReturn(false);
        assertThrows(StoreNotFoundException.class, () -> service.getExpectedCashForSuperAdmin(STORE_ID));
        verify(entryRepository, never()).findFirstByStoreIdAndBusinessDateLessThanEqualOrderByBusinessDateDesc(any(), any());
    }

    @Test
    void superAdmin_existingStore_isAllowed() {
        when(storeRepository.existsById(STORE_ID)).thenReturn(true);
        when(latestOnOrBeforeToday()).thenReturn(Optional.of(
            entry("2026-11-09", "100", "0", "100", "0", "0")));
        assertMoney("100.00", service.getExpectedCashForSuperAdmin(STORE_ID).expectedCashOnHand());
    }

    // ---- single-source-of-truth guard --------------------------------------

    // The formula's inputs may be read only by: the entity itself, the audit
    // snapshot, the plain response mapper, and CashCalculationService. Anything
    // else reading them is how a second copy of the arithmetic would start, so
    // new callers must go through CashCalculationService instead.
    // SuperAdminCashReviewService is allowed because it reads those getters
    // only to populate its review DTO -- its "expected cash on hand" is a
    // separate, DB-aggregated figure (sum of cash_remaining + other_adjustments
    // per the Super Admin spec) and never re-implements the formula.
    private static final Set<String> MAY_READ_FORMULA_INPUTS = Set.of(
        "DailyCashEntry.java",
        "DailyCashEntryCorrection.java",
        "DailyCashEntryService.java",
        "CashCalculationService.java",
        "SuperAdminCashReviewService.java",
        // Maps entries to history figures for display; no arithmetic.
        "CashHistoryService.java"
    );

    @Test
    void onlyCashCalculationServiceDerivesExpectedCash() throws IOException {
        Path root = Path.of("src/main/java");
        assertTrue(Files.isDirectory(root), "run from the backend module root");
        List<String> offenders;
        try (Stream<Path> files = Files.walk(root)) {
            offenders = files
                .filter(p -> p.toString().endsWith(".java"))
                .filter(p -> !MAY_READ_FORMULA_INPUTS.contains(p.getFileName().toString()))
                .filter(p -> {
                    try {
                        String src = Files.readString(p);
                        return src.contains(".getOpeningDrawerCash()") || src.contains(".getCashExpenses()");
                    } catch (IOException e) {
                        throw new RuntimeException(e);
                    }
                })
                .map(p -> p.getFileName().toString())
                .collect(Collectors.toList());
        }
        assertTrue(offenders.isEmpty(),
            "Expected-cash arithmetic must live only in CashCalculationService; found formula inputs read in: "
                + offenders);
    }
}
