package com.nforce.retailops.exception;

// Flag can't be raised or edited the way the caller asked -- see
// GlobalExceptionHandler for the HTTP mapping (409).
public class CashEntryFlagException extends RuntimeException {
    public CashEntryFlagException(String message) {
        super(message);
    }
}
