package com.nforce.retailops.service;

import com.nforce.retailops.dto.DailyCashBreakdown;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MonthlyCashSummaryServiceTest {

    @Mock DailyCashEntryRepository entryRepository;
    @Mock StoreOwnerRepository storeOwnerRepository;
    @Mock StoreRepository storeRepository;

    MonthlyCashSummaryService service;
    Store store1;
    Store store2;

    @BeforeEach
    void setUp() {
        // Real calculator: the summary must agree with the one formula.
        CashCalculationService calc = new CashCalculationService(entryRepository, storeOwnerRepository, storeRepository);
        service = new MonthlyCashSummaryService(entryRepository, storeOwnerRepository, storeRepository, calc);
        store1 = store(1L, "Store 1");
        store2 = store(2L, "Store 2");
    }

    private static Store store(Long id, String name) {
        Store s = new Store();
        ReflectionTestUtils.setField(s, "id", id);
        ReflectionTestUtils.setField(s, "name", name);
        ReflectionTestUtils.setField(s, "active", true);
        return s;
    }

    private static DailyCashEntry entry(Store store, String date, String opening, String removed,
                                        String remaining, String adjust) {
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
        assertNotNull(actual, "expected " + expected + " but was null");
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " but was " + actual);
    }

    @Test
    void superAdmin_sumsFlowsPerStore_takesPositionFromLastDay_andCombines() {
        when(storeRepository.findAllById(any())).thenReturn(List.of(store2, store1));
        when(entryRepository.findForStoresBetween(any(), eq(LocalDate.parse("2026-10-01")), eq(LocalDate.parse("2026-10-31"))))
            .thenReturn(List.of(
                // Cash remaining +/- adjustments: day 1 = 340, day 31 = 275 - 10 = 265
                entry(store1, "2026-10-01", "500", "100", "340", "0"),
                entry(store1, "2026-10-31", "500", "200", "275", "-10"),
                entry(store2, "2026-10-15", "450", "0", "450", "0")
            ));

        MonthlyCashSummaryResponse r = service.getForSuperAdmin("2026-10", List.of(1L, 2L));

        assertEquals("2026-10", r.month());
        assertEquals(List.of("Store 1", "Store 2"), r.stores().stream().map(StoreMonthlyCashSummary::storeName).toList());

        StoreMonthlyCashSummary s1 = r.stores().get(0);
        assertEquals(2, s1.daysRecorded());
        assertEquals(LocalDate.parse("2026-10-31"), s1.asOfDate());
        assertMoney("300", s1.totalCashRemoved());
        assertMoney("615", s1.totalCashRemaining());
        assertMoney("-10", s1.adjustments());
        assertMoney("605", s1.expectedCashOnHand()); // 340 + 265, running total

        StoreMonthlyCashSummary c = r.combined();
        assertNull(c.storeId());
        assertEquals("Combined", c.storeName());
        assertEquals(3, c.daysRecorded());
        assertMoney("300", c.totalCashRemoved());
        assertMoney("1065", c.totalCashRemaining());
        assertMoney("-10", c.adjustments());
        assertMoney("1055", c.expectedCashOnHand()); // 605 + 450
    }

    @Test
    void storeWithNoEntries_isNullNotZero_andExcludedFromCombined() {
        when(storeRepository.findAllById(any())).thenReturn(List.of(store1, store2));
        when(entryRepository.findForStoresBetween(any(), any(), any())).thenReturn(List.of(
            entry(store1, "2026-10-05", "250", "0", "250", "0")
        ));

        MonthlyCashSummaryResponse r = service.getForSuperAdmin("2026-10", List.of(1L, 2L));

        StoreMonthlyCashSummary empty = r.stores().get(1);
        assertEquals(0, empty.daysRecorded());
        assertNull(empty.totalCashRemoved());
        assertNull(empty.expectedCashOnHand());
        assertMoney("0", r.combined().totalCashRemoved());
        assertMoney("250", r.combined().totalCashRemaining());
    }

    @Test
    void noEntriesAnywhere_combinedIsEmpty() {
        when(storeRepository.findAllById(any())).thenReturn(List.of(store1));
        when(entryRepository.findForStoresBetween(any(), any(), any())).thenReturn(List.of());

        StoreMonthlyCashSummary c = service.getForSuperAdmin("2026-10", List.of(1L)).combined();

        assertEquals(0, c.daysRecorded());
        assertNull(c.expectedCashOnHand());
    }

    @Test
    void superAdmin_defaultStores_areActivePlusAnyThatTradedThatMonth() {
        when(storeRepository.findByActiveTrueOrderByName()).thenReturn(List.of(store1));
        when(entryRepository.findStoreIdsWithEntriesBetween(any(), any())).thenReturn(List.of(2L));
        when(storeRepository.findAllById(any())).thenReturn(List.of(store1, store2));
        when(entryRepository.findForStoresBetween(any(), any(), any())).thenReturn(List.of());

        service.getForSuperAdmin("2026-10", null);

        verify(storeRepository).findAllById(argThat(ids -> {
            List<Long> list = new java.util.ArrayList<>();
            ids.forEach(list::add);
            return list.containsAll(List.of(1L, 2L)) && list.size() == 2;
        }));
    }

    @Test
    void superAdmin_unknownStoreId_is404() {
        when(storeRepository.findAllById(any())).thenReturn(List.of(store1));
        assertThrows(StoreNotFoundException.class, () -> service.getForSuperAdmin("2026-10", List.of(1L, 99L)));
    }

    @Test
    void owner_seesOnlyTheirActiveStore() {
        StoreOwner link = new StoreOwner();
        link.setStore(store1);
        when(storeOwnerRepository.findByOwnerId(42L)).thenReturn(List.of(link));
        when(entryRepository.findForStoresBetween(eq(List.of(1L)), any(), any())).thenReturn(List.of());

        MonthlyCashSummaryResponse r = service.getForOwner(42L, "2026-10");

        assertEquals(1, r.stores().size());
        assertEquals(1L, r.stores().get(0).storeId());
    }

    @Test
    void owner_withoutActiveStore_is404() {
        when(storeOwnerRepository.findByOwnerId(42L)).thenReturn(List.of());
        assertThrows(StoreNotFoundException.class, () -> service.getForOwner(42L, "2026-10"));
    }

    @Test
    void dailyBreakdown_listsRecordedDaysOldestFirst_andReconcilesToTotalsAndClosingFigures() {
        when(storeRepository.findAllById(any())).thenReturn(List.of(store1));
        // Deliberately out of order and with gaps: only recorded days appear.
        when(entryRepository.findForStoresBetween(any(), any(), any())).thenReturn(List.of(
            entry(store1, "2026-10-31", "500", "200", "275", "-10"),
            entry(store1, "2026-10-01", "500", "100", "340", "0"),
            entry(store1, "2026-10-12", "450", "0", "450", "0")
        ));

        StoreMonthlyCashSummary s = service.getForSuperAdmin("2026-10", List.of(1L)).stores().get(0);
        List<DailyCashBreakdown> days = s.dailyBreakdown();

        assertEquals(s.daysRecorded(), days.size());
        assertEquals(List.of(LocalDate.parse("2026-10-01"), LocalDate.parse("2026-10-12"), LocalDate.parse("2026-10-31")),
            days.stream().map(DailyCashBreakdown::businessDate).toList());

        DailyCashBreakdown first = days.get(0);
        assertMoney("500", first.openingDrawerCash());
        assertMoney("100", first.cashRemoved());
        assertMoney("340", first.cashRemaining());
        assertMoney("0", first.adjustments());
        assertMoney("340", first.dailyExpected());
        assertMoney("340", first.expectedCashOnHand());
        assertMoney("790", days.get(1).expectedCashOnHand());

        // Totals are the column sums of the rows.
        assertMoney(columnSum(days, DailyCashBreakdown::cashRemoved).toPlainString(), s.totalCashRemoved());
        assertMoney(columnSum(days, DailyCashBreakdown::cashRemaining).toPlainString(), s.totalCashRemaining());
        assertMoney(columnSum(days, DailyCashBreakdown::adjustments).toPlainString(), s.adjustments());

        // The headline position is the last row's running total.
        DailyCashBreakdown last = days.get(days.size() - 1);
        assertEquals(s.asOfDate(), last.businessDate());
        assertMoney("1055", last.expectedCashOnHand());
        assertMoney(last.expectedCashOnHand().toPlainString(), s.expectedCashOnHand());
    }

    @Test
    void expectedCashOnHand_isMonthToDateOnly_notCarriedFromEarlierMonths_andIgnoresCashRemoved() {
        when(storeRepository.findAllById(any())).thenReturn(List.of(store1));
        when(entryRepository.findForStoresBetween(any(), any(), any())).thenReturn(List.of(
            entry(store1, "2026-11-03", "100", "0", "100", "0"),
            // a large opening drawer and cash removed change nothing
            entry(store1, "2026-11-12", "9000", "4500", "10", "5")
        ));

        StoreMonthlyCashSummary s = service.getForSuperAdmin("2026-11", List.of(1L)).stores().get(0);

        assertEquals(2, s.dailyBreakdown().size());
        DailyCashBreakdown last = s.dailyBreakdown().get(1);
        assertMoney("15", last.dailyExpected());
        assertMoney("115", last.expectedCashOnHand());
        assertMoney("115", s.expectedCashOnHand());
        assertMoney("4500", s.totalCashRemoved());
    }

    @Test
    void dailyBreakdown_isEmptyForNoEntriesAndForCombined() {
        when(storeRepository.findAllById(any())).thenReturn(List.of(store1, store2));
        when(entryRepository.findForStoresBetween(any(), any(), any())).thenReturn(List.of(
            entry(store1, "2026-10-05", "250", "0", "250", "0")
        ));

        MonthlyCashSummaryResponse r = service.getForSuperAdmin("2026-10", List.of(1L, 2L));

        assertEquals(1, r.stores().get(0).dailyBreakdown().size());
        assertNotNull(r.stores().get(1).dailyBreakdown());
        assertTrue(r.stores().get(1).dailyBreakdown().isEmpty());
        assertTrue(r.combined().dailyBreakdown().isEmpty());
    }

    private static BigDecimal columnSum(List<DailyCashBreakdown> days,
                                        java.util.function.Function<DailyCashBreakdown, BigDecimal> field) {
        return days.stream().map(field).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Test
    void currentMonth_endsToday() {
        when(storeRepository.findAllById(any())).thenReturn(List.of(store1));
        when(entryRepository.findForStoresBetween(any(), any(), any())).thenReturn(List.of());

        MonthlyCashSummaryResponse r = service.getForSuperAdmin(null, List.of(1L));

        assertEquals(YearMonth.now().toString(), r.month());
        assertEquals(LocalDate.now(), r.periodEnd());
    }

    @Test
    void badOrFutureMonth_isRejected() {
        assertThrows(InvalidDateRangeException.class, () -> MonthlyCashSummaryService.parseMonth("Oct 2026"));
        assertThrows(InvalidDateRangeException.class,
            () -> MonthlyCashSummaryService.parseMonth(YearMonth.now().plusMonths(1).toString()));
    }
}
