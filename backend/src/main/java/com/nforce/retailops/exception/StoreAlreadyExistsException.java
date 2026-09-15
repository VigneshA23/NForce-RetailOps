package com.nforce.retailops.exception;

public class StoreAlreadyExistsException extends RuntimeException {

    public StoreAlreadyExistsException(String message) {
        super(message);
    }
}
