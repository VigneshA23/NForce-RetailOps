package com.nforce.retailops.exception;

// Today's Start of Day refused because yesterday's End of Day for the item was
// neither counted nor explained yet.
public class MissedEndOfDayPendingException extends RuntimeException {
    public MissedEndOfDayPendingException(String message) {
        super(message);
    }
}
