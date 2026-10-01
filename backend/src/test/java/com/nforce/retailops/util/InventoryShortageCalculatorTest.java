package com.nforce.retailops.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class InventoryShortageCalculatorTest {

    @Test
    void countBelowMinimumReturnsTheDifference() {
        assertThat(InventoryShortageCalculator.calculateQuantityNeeded(20, 15)).isEqualTo(5);
    }

    @Test
    void countEqualToMinimumReturnsZero() {
        assertThat(InventoryShortageCalculator.calculateQuantityNeeded(20, 20)).isEqualTo(0);
    }

    @Test
    void countAboveMinimumFloorsAtZeroRatherThanGoingNegative() {
        assertThat(InventoryShortageCalculator.calculateQuantityNeeded(20, 25)).isEqualTo(0);
    }

    @Test
    void zeroCountNeedsTheFullMinimum() {
        assertThat(InventoryShortageCalculator.calculateQuantityNeeded(20, 0)).isEqualTo(20);
    }

    @Test
    void zeroMinimumWithZeroCountReturnsZero() {
        assertThat(InventoryShortageCalculator.calculateQuantityNeeded(0, 0)).isEqualTo(0);
    }

    @Test
    void missingMinimumConfigurationReturnsZeroRegardlessOfCount() {
        assertThat(InventoryShortageCalculator.calculateQuantityNeeded(null, 0)).isEqualTo(0);
    }
}
