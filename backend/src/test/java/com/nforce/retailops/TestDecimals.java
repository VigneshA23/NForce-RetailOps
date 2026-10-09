package com.nforce.retailops;

import java.math.BigDecimal;

/** Test helper for building stock quantities (NUMERIC(12,2)) from int literals. */
public final class TestDecimals {

    private TestDecimals() {
    }

    public static BigDecimal bd(Integer value) {
        return value == null ? null : BigDecimal.valueOf(value).setScale(2);
    }

    public static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }
}
