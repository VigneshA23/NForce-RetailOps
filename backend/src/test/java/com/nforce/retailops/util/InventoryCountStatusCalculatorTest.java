package com.nforce.retailops.util;

import com.nforce.retailops.dto.InventoryCountStatus;
import com.nforce.retailops.entity.StockCheck;
import com.nforce.retailops.entity.StockCheckSnapshot;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class InventoryCountStatusCalculatorTest {

    private StockCheck checkWithCount(LocalDate date, int available) {
        StockCheck check = new StockCheck();
        check.setCheckDate(date);
        check.recordSnapshot(StockCheckSnapshot.START_OF_DAY, available, 0, null, OffsetDateTime.now(), false);
        return check;
    }

    @Test
    void noCheckAtAllIsStale() {
        assertThat(InventoryCountStatusCalculator.calculate(null, LocalDate.now(), 10))
            .isEqualTo(InventoryCountStatus.STALE);
    }

    @Test
    void staleFreshnessWinsOverWhatWouldOtherwiseBeOutOfStock() {
        StockCheck yesterdayZero = checkWithCount(LocalDate.now().minusDays(1), 0);
        assertThat(InventoryCountStatusCalculator.calculate(yesterdayZero, LocalDate.now(), 10))
            .isEqualTo(InventoryCountStatus.STALE);
    }

    @Test
    void todayAtZeroIsOutOfStock() {
        StockCheck todayZero = checkWithCount(LocalDate.now(), 0);
        assertThat(InventoryCountStatusCalculator.calculate(todayZero, LocalDate.now(), 10))
            .isEqualTo(InventoryCountStatus.OUT_OF_STOCK);
    }

    @Test
    void todayBelowMinimumIsLow() {
        StockCheck todayLow = checkWithCount(LocalDate.now(), 5);
        assertThat(InventoryCountStatusCalculator.calculate(todayLow, LocalDate.now(), 10))
            .isEqualTo(InventoryCountStatus.LOW);
    }

    @Test
    void todayAtOrAboveMinimumIsHealthy() {
        StockCheck todayHealthy = checkWithCount(LocalDate.now(), 10);
        assertThat(InventoryCountStatusCalculator.calculate(todayHealthy, LocalDate.now(), 10))
            .isEqualTo(InventoryCountStatus.HEALTHY);
    }

    @Test
    void nullMinimumNeverProducesLow() {
        StockCheck todayLowCount = checkWithCount(LocalDate.now(), 1);
        assertThat(InventoryCountStatusCalculator.calculate(todayLowCount, LocalDate.now(), null))
            .isEqualTo(InventoryCountStatus.HEALTHY);
    }
}
