package com.nforce.retailops.exception;

public class StoreHasNoActiveOwnerException extends RuntimeException {
    public StoreHasNoActiveOwnerException(String message) {
        super(message);
    }
}
