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

    private DailyCashEntry entry(String date, String opening, String removed, String remaining, String adjust) {
        DailyCashEntry e = new DailyCashEntry();
        e.setStore(store);
        e.setBusinessDate(LocalDate.parse(date));
        e.setOpeningDrawerCash(new BigDecimal(opening));
        e.setCashRemoved(new BigDecimal(removed));
        e.setCashRemaining(new BigDecimal(remaining));
        e.setOtherAdjustments(new BigDecimal(adjust));
        return e;
    }

    private static void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " but was " + actual);
    }

    // ---- the formula --------------------------------------------------------

    @Test
    void formula_isCashRemainingPlusAdjustments() {
        DailyCashEntry e = entry("2026-11-09", "200", "100", "75", "25");
        assertMoney("100.00", service.calculateExpectedCash(e));
        assertMoney("100.00", CashCalculationService.dailyExpected(new BigDecimal("75"), new BigDecimal("25")));
    }

    @Test
    void formula_negativeOtherAdjustmentReducesExpectedCash() {
        DailyCashEntry e = entry("2026-11-09", "200", "100", "40", "-10");
        assertMoney("30.00", service.calculateExpectedCash(e));
    }

    @Test
    void formula_ignoresOpeningDrawerAndCashRemoved() {
        DailyCashEntry a = entry("2026-11-09", "0", "0", "80", "0");
        DailyCashEntry b = entry("2026-11-09", "9999", "5000", "80", "0");
        assertMoney("80.00", service.calculateExpectedCash(a));
        assertMoney("80.00", service.calculateExpectedCash(b));
    }

    @Test
    void formula_missingAmountsCountAsZero() {
        assertMoney("0.00", CashCalculationService.dailyExpected(null, null));
        assertMoney("7.00", CashCalculationService.dailyExpected(null, new BigDecimal("7")));
        assertMoney("5.00", CashCalculationService.dailyExpected(new BigDecimal("5"), null));
    }

    @Test
    void calculate_exposesTheRecordedFiguresWithoutAVariance() {
        ExpectedCashResponse r = service.calculate(entry("2026-11-09", "200", "100", "60", "25"));
        assertMoney("85.00", r.expectedCashOnHand());
        assertMoney("60.00", r.cashRemaining());
        assertMoney("200.00", r.openingDrawerCash());
        assertMoney("100.00", r.cashRemoved());
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
            entry(today.minusDays(2).toString(), "200", "100", "75", "25"),
            entry(today.plusYears(5).toString(), "0", "0", "0", "0"));
        when(entryRepository.sumExpectedCashOnHandUpTo(STORE_ID, today.minusDays(2)))
            .thenReturn(new BigDecimal("100.00"));
        ExpectedCashResponse r = service.getExpectedCashForStore(STORE_ID);
        assertTrue(r.available());
        assertEquals(today.minusDays(2), r.asOfDate());
        assertMoney("100.00", r.expectedCashOnHand());
    }

    @Test
    void onlyFutureDatedEntries_isNotAvailable() {
        storeHoldsEntries(entry(LocalDate.now().plusDays(30).toString(), "200", "100", "75", "25"));
        ExpectedCashResponse r = service.getExpectedCashForStore(STORE_ID);
        assertFalse(r.available());
        assertNull(r.asOfDate());
    }

    @Test
    void anEntryDatedToday_isLive() {
        LocalDate today = LocalDate.now();
        storeHoldsEntries(entry(today.toString(), "200", "100", "75", "25"));
        when(entryRepository.sumExpectedCashOnHandUpTo(STORE_ID, today)).thenReturn(new BigDecimal("100"));
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
        assertNull(r.asOfDate());
        assertNull(r.lastUpdatedAt());
    }

    @Test
    void lastUpdatedAt_isWhenTheLatestEntryWasLastSaved() {
        DailyCashEntry e = entry("2026-11-09", "200", "100", "75", "25");
        OffsetDateTime savedAt = OffsetDateTime.parse("2026-11-09T21:15:00+05:30");
        e.setUpdatedAt(savedAt);
        ExpectedCashResponse r = service.calculate(e);
        assertEquals(savedAt, r.lastUpdatedAt());
        assertEquals(LocalDate.parse("2026-11-09"), r.asOfDate());
    }

    @Test
    void singleEntry_usesThatDay_andReportsAsOfDate() {
        when(latestOnOrBeforeToday()).thenReturn(Optional.of(
            entry("2026-11-09", "200", "100", "75", "25")));
        when(entryRepository.sumExpectedCashOnHandUpTo(STORE_ID, LocalDate.of(2026, 11, 9)))
            .thenReturn(new BigDecimal("100.00"));
        ExpectedCashResponse r = service.getExpectedCashForStore(STORE_ID);
        assertTrue(r.available());
        assertEquals(LocalDate.of(2026, 11, 9), r.asOfDate());
        assertMoney("100.00", r.expectedCashOnHand());
    }

    @Test
    void oldEntry_isStillShownAsLive_withLastUpdatedAt() {
        // BA decision: no staleness cutoff. A 6-day-old entry is still the live figure.
        DailyCashEntry old = entry("2020-01-01", "200", "100", "75", "25");
        java.time.OffsetDateTime saved = java.time.OffsetDateTime.parse("2020-01-01T21:30:00Z");
        ReflectionTestUtils.setField(old, "updatedAt", saved);
        when(latestOnOrBeforeToday()).thenReturn(Optional.of(old));
        when(entryRepository.sumExpectedCashOnHandUpTo(STORE_ID, LocalDate.parse("2020-01-01")))
            .thenReturn(new BigDecimal("100.00"));
        ExpectedCashResponse r = service.getExpectedCashForStore(STORE_ID);
        assertTrue(r.available());
        assertEquals(saved, r.lastUpdatedAt());
        assertMoney("100.00", r.expectedCashOnHand());
    }

    @Test
    void noEntries_hasNoLastUpdatedAt() {
        when(latestOnOrBeforeToday()).thenReturn(Optional.empty());
        assertNull(service.getExpectedCashForStore(STORE_ID).lastUpdatedAt());
    }

    @Test
    void multipleDays_figureIsTheRunningSumUpToTheLatestEntry() {
        when(latestOnOrBeforeToday()).thenReturn(Optional.of(
            entry("2026-11-09", "400", "0", "405", "5")));
        when(entryRepository.sumExpectedCashOnHandUpTo(STORE_ID, LocalDate.of(2026, 11, 9)))
            .thenReturn(new BigDecimal("900.00"));
        ExpectedCashResponse r = service.getExpectedCashForStore(STORE_ID);
        assertMoney("900.00", r.expectedCashOnHand());
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
            entry("2026-11-09", "100", "0", "100", "0")));
        when(entryRepository.sumExpectedCashOnHandUpTo(STORE_ID, LocalDate.of(2026, 11, 9)))
            .thenReturn(new BigDecimal("100.00"));
        assertMoney("100.00", service.getExpectedCashForSuperAdmin(STORE_ID).expectedCashOnHand());
    }

    // ---- single-source-of-truth guard --------------------------------------

    // The formula's inputs may be read only by: the entity itself, the audit
    // snapshot, the plain response mapper, and CashCalculationService. Anything
    // else reading them is how a second copy of the arithmetic would start, so
    // new callers must go through CashCalculationService instead.
    private static final Set<String> MAY_READ_FORMULA_INPUTS = Set.of(
        "DailyCashEntry.java",
        "DailyCashEntryCorrection.java",
        "DailyCashEntryService.java",
        "CashCalculationService.java",
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
                        return src.contains(".getOpeningDrawerCash()");
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
