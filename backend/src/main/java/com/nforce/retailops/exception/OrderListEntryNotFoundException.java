package com.nforce.retailops.exception;

public class OrderListEntryNotFoundException extends RuntimeException {

    public OrderListEntryNotFoundException(String message) {
        super(message);
    }
}
