package com.nforce.retailops.exception;

public class StockCheckLockedException extends RuntimeException {
    public StockCheckLockedException(String message) {
        super(message);
    }
}
