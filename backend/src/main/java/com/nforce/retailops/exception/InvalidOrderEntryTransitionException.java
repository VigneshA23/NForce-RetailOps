package com.nforce.retailops.exception;

public class InvalidOrderEntryTransitionException extends RuntimeException {

    public InvalidOrderEntryTransitionException(String message) {
        super(message);
    }
}
