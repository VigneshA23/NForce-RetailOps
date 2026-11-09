package com.nforce.retailops.exception;

public class DailyCashEntryNotFoundException extends RuntimeException {
    public DailyCashEntryNotFoundException(String message) {
        super(message);
    }
}
