package com.nforce.retailops.service;

import com.nforce.retailops.dto.DailyCashEntryRequest;
import com.nforce.retailops.dto.DailyCashEntryResponse;
import com.nforce.retailops.dto.ExpectedCashRangeResponse;
import com.nforce.retailops.dto.SuperAdminCashCorrectionRequest;
import com.nforce.retailops.entity.DailyCashEntry;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.exception.InvalidDateRangeException;
import com.nforce.retailops.repository.DailyCashEntryRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SuperAdminRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Covers the "Expected cash on hand as of the viewed date" story. The daily
// figure (cash_remaining + other_adjustments) is saved on the row and summed
// at the DB; these tests exercise the whole path -- save, re-save, correct,
// no-entry days, negative adjustments and a date range -- against H2.
@SpringBootTest
@ActiveProfiles("test")
class ExpectedCashOnHandTest {

    @Autowired DailyCashEntryService entryService;
    @Autowired SuperAdminCashReviewService reviewService;
    @Autowired DailyCashEntryRepository entryRepository;
    @Autowired StoreRepository storeRepository;
    @Autowired SuperAdminRepository superAdminRepository;

    private Fixture newFixture() {
        String suffix = UUID.randomUUID().toString();
        Store store = new Store();
        store.setName("Expected cash " + suffix);
        store.setStoreCode(Math.abs(UUID.randomUUID().getMostSignificantBits()));
        store.setActive(true);
        store = storeRepository.save(store);

        SuperAdmin sa = new SuperAdmin();
        sa.setName("Expected cash test");
        sa.setEmail("expected-cash-" + suffix + "@nforce.test");
        sa.setPasswordHash("test-password-hash");
        sa = superAdminRepository.save(sa);
        return new Fixture(store.getId(), sa.getId());
    }

    private static DailyCashEntryRequest req(LocalDate date, String cashRemaining, String otherAdj) {
        return new DailyCashEntryRequest(
            date,
            new BigDecimal("100"),              // openingDrawerCash
            new BigDecimal("5"),                // cashExpenses
            new BigDecimal("10"),               // cashRemoved
            new BigDecimal(cashRemaining),      // cashRemaining
            new BigDecimal(otherAdj),           // otherAdjustments (signed)
            null);                              // correctionReason (unused on first save)
    }

    // ---- 1. One day --------------------------------------------------------

    @Test
    void oneDay_runningTotalEqualsThatDay() {
        Fixture f = newFixture();
        LocalDate d = LocalDate.of(2026, 11, 10);
        DailyCashEntryResponse r = entryService.saveForSuperAdmin(
            f.superAdminId(), f.storeId(), req(d, "600.00", "0"));

        assertThat(r.dailyExpectedCash()).isEqualByComparingTo("600.00");
        assertThat(r.expectedCashOnHand()).isEqualByComparingTo("600.00");
    }

    // ---- 2. Several days ---------------------------------------------------

    @Test
    void severalDays_runningTotalAccumulatesEveryDay() {
        Fixture f = newFixture();
        entryService.saveForSuperAdmin(f.superAdminId(), f.storeId(),
            req(LocalDate.of(2026, 11, 10), "100.00", "0"));
        entryService.saveForSuperAdmin(f.superAdminId(), f.storeId(),
            req(LocalDate.of(2026, 11, 11), "150.00", "0"));
        DailyCashEntryResponse latest = entryService.saveForSuperAdmin(
            f.superAdminId(), f.storeId(), req(LocalDate.of(2026, 11, 12), "200.00", "0"));

        assertThat(latest.dailyExpectedCash()).isEqualByComparingTo("200.00");
        assertThat(latest.expectedCashOnHand()).isEqualByComparingTo("450.00");
    }

    // ---- 3. A day with no entry -------------------------------------------

    @Test
    void dayWithNoEntry_addsZero_runningTotalStillCorrect() {
        Fixture f = newFixture();
        entryService.saveForSuperAdmin(f.superAdminId(), f.storeId(),
            req(LocalDate.of(2026, 11, 10), "100.00", "0"));
        // 2026-11-11: no entry.
        entryService.saveForSuperAdmin(f.superAdminId(), f.storeId(),
            req(LocalDate.of(2026, 11, 12), "250.00", "0"));

        BigDecimal upToGap = entryRepository.sumExpectedCashOnHandUpTo(f.storeId(), LocalDate.of(2026, 11, 11));
        BigDecimal upToAfter = entryRepository.sumExpectedCashOnHandUpTo(f.storeId(), LocalDate.of(2026, 11, 12));

        assertThat(upToGap).isEqualByComparingTo("100.00");     // only day 10
        assertThat(upToAfter).isEqualByComparingTo("350.00");   // day 10 + day 12
    }

    // ---- 4. A negative adjustment -----------------------------------------

    @Test
    void negativeAdjustment_reducesTheDayAndRunningTotal() {
        Fixture f = newFixture();
        entryService.saveForSuperAdmin(f.superAdminId(), f.storeId(),
            req(LocalDate.of(2026, 11, 10), "500.00", "0"));
        DailyCashEntryResponse withNeg = entryService.saveForSuperAdmin(
            f.superAdminId(), f.storeId(), req(LocalDate.of(2026, 11, 11), "300.00", "-50.00"));

        // Day's daily figure is 300 + (-50) = 250; running total is 500 + 250 = 750.
        assertThat(withNeg.dailyExpectedCash()).isEqualByComparingTo("250.00");
        assertThat(withNeg.expectedCashOnHand()).isEqualByComparingTo("750.00");
    }

    // ---- 5. A correction on an earlier day --------------------------------

    @Test
    void correctionOnEarlierDay_recomputesRunningTotalFromThatDayForward() {
        Fixture f = newFixture();
        DailyCashEntryResponse day10 = entryService.saveForSuperAdmin(f.superAdminId(), f.storeId(),
            req(LocalDate.of(2026, 11, 10), "100.00", "0"));
        DailyCashEntryResponse day11 = entryService.saveForSuperAdmin(f.superAdminId(), f.storeId(),
            req(LocalDate.of(2026, 11, 11), "200.00", "0"));

        // Before correction: 100 + 200 = 300 at day 11.
        assertThat(day11.expectedCashOnHand()).isEqualByComparingTo("300.00");

        // Correct day 10's cash_remaining from 100 to 180 (adjustments unchanged).
        SuperAdminCashCorrectionRequest correction = new SuperAdminCashCorrectionRequest(
            new BigDecimal("100"),      // openingDrawerCash
            new BigDecimal("5"),        // cashExpenses
            new BigDecimal("10"),       // cashRemoved
            new BigDecimal("180.00"),   // cashRemaining (was 100)
            new BigDecimal("0"),        // otherAdjustments
            "Owner found an extra 80 in the drawer");
        reviewService.correct(f.superAdminId(), f.storeId(), day10.id(), correction);

        // After correction: day 10 = 180, day 11 unchanged at 200. Running at
        // day 10 = 180; running at day 11 = 380. The stored daily figure for
        // day 10 was recomputed on correction, so the DB SUM reflects it.
        DailyCashEntry refreshed10 = entryRepository.findById(day10.id()).orElseThrow();
        assertThat(refreshed10.getDailyExpectedCash()).isEqualByComparingTo("180.00");

        assertThat(entryRepository.sumExpectedCashOnHandUpTo(f.storeId(), LocalDate.of(2026, 11, 10)))
            .isEqualByComparingTo("180.00");
        assertThat(entryRepository.sumExpectedCashOnHandUpTo(f.storeId(), LocalDate.of(2026, 11, 11)))
            .isEqualByComparingTo("380.00");
    }

    // ---- 6. A date range ---------------------------------------------------

    @Test
    void dateRange_sumsOnlyEntriesInsideTheRange_inclusive() {
        Fixture f = newFixture();
        entryService.saveForSuperAdmin(f.superAdminId(), f.storeId(),
            req(LocalDate.of(2026, 11, 9), "999.00", "0"));   // before range
        entryService.saveForSuperAdmin(f.superAdminId(), f.storeId(),
            req(LocalDate.of(2026, 11, 10), "100.00", "0"));  // in range
        // 2026-11-11 missing on purpose.
        entryService.saveForSuperAdmin(f.superAdminId(), f.storeId(),
            req(LocalDate.of(2026, 11, 12), "250.00", "-25.00")); // in range, with signed adj
        entryService.saveForSuperAdmin(f.superAdminId(), f.storeId(),
            req(LocalDate.of(2026, 11, 13), "77.00", "0"));   // after range

        ExpectedCashRangeResponse range = entryService.getRangeSumForSuperAdmin(
            f.storeId(), LocalDate.of(2026, 11, 10), LocalDate.of(2026, 11, 12));

        // 100 + (250 - 25) = 325. The missing day adds 0; the surrounding days
        // are outside the range.
        assertThat(range.expectedCashOnHand()).isEqualByComparingTo("325.00");
        assertThat(range.from()).isEqualTo(LocalDate.of(2026, 11, 10));
        assertThat(range.to()).isEqualTo(LocalDate.of(2026, 11, 12));
    }

    @Test
    void dateRange_emptyRange_returnsZero_notNull() {
        Fixture f = newFixture();
        ExpectedCashRangeResponse range = entryService.getRangeSumForSuperAdmin(
            f.storeId(), LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30));
        assertThat(range.expectedCashOnHand()).isEqualByComparingTo("0");
    }

    @Test
    void dateRange_toBeforeFrom_isRejected() {
        Fixture f = newFixture();
        assertThatThrownBy(() -> entryService.getRangeSumForSuperAdmin(
            f.storeId(), LocalDate.of(2026, 11, 10), LocalDate.of(2026, 11, 1)))
            .isInstanceOf(InvalidDateRangeException.class);
    }

    private record Fixture(Long storeId, Long superAdminId) {
    }
}
