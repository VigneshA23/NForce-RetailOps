package com.nforce.retailops.exception;

public class StockReceiptRequestNotFoundException extends RuntimeException {
    public StockReceiptRequestNotFoundException(String message) {
        super(message);
    }
}
