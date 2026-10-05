package com.nforce.retailops.exception;

public class InvalidOrderListEntryException extends RuntimeException {
    public InvalidOrderListEntryException(String message) {
        super(message);
    }
}
