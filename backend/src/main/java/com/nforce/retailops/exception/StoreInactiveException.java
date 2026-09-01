package com.nforce.retailops.exception;

public class StoreInactiveException extends RuntimeException {
    public StoreInactiveException(String message) {
        super(message);
    }
}
