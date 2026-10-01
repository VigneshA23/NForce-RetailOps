package com.nforce.retailops.entity;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class StoreInventoryItemTest {

    // 2026-09-28 is a Monday; 2026-10-03/04 are Saturday/Sunday.
    private static final LocalDate MONDAY = LocalDate.of(2026, 9, 28);
    private static final LocalDate FRIDAY = LocalDate.of(2026, 10, 2);
    private static final LocalDate SATURDAY = LocalDate.of(2026, 10, 3);
    private static final LocalDate SUNDAY = LocalDate.of(2026, 10, 4);

    private static StoreInventoryItem item(Integer minWeekday, Integer minWeekend) {
        StoreInventoryItem item = new StoreInventoryItem();
        item.setMinWeekday(minWeekday);
        item.setMinWeekend(minWeekend);
        return item;
    }

    @Test
    void weekdaysRequireTheWeekdayMinimum() {
        StoreInventoryItem item = item(8, 12);
        assertThat(item.requiredMinimumOn(MONDAY)).isEqualTo(8);
        assertThat(item.requiredMinimumOn(FRIDAY)).isEqualTo(8);
    }

    @Test
    void saturdayAndSundayRequireTheWeekendMinimum() {
        StoreInventoryItem item = item(8, 12);
        assertThat(item.requiredMinimumOn(SATURDAY)).isEqualTo(12);
        assertThat(item.requiredMinimumOn(SUNDAY)).isEqualTo(12);
    }

    @Test
    void weekendFallsBackToTheWeekdayMinimumWhenNoneIsSet() {
        StoreInventoryItem item = item(8, null);
        assertThat(item.requiredMinimumOn(SATURDAY)).isEqualTo(8);
    }

    @Test
    void noMinimumAtAllIsNull() {
        assertThat(item(null, null).requiredMinimumOn(MONDAY)).isNull();
    }
}
