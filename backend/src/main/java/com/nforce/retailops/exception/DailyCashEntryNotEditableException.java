package com.nforce.retailops.exception;

// An employee tried to record or edit a cash entry for a day other than today.
public class DailyCashEntryNotEditableException extends RuntimeException {
    public DailyCashEntryNotEditableException(String message) {
        super(message);
    }
}
