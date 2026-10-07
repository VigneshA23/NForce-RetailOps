package com.nforce.retailops.exception;

public class StoreInventoryItemNameExistsException extends RuntimeException {

    public StoreInventoryItemNameExistsException(String message) {
        super(message);
    }
}
