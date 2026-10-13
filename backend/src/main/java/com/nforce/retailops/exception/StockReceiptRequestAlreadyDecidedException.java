package com.nforce.retailops.exception;

public class StockReceiptRequestAlreadyDecidedException extends RuntimeException {
    public StockReceiptRequestAlreadyDecidedException(String message) {
        super(message);
    }
}
