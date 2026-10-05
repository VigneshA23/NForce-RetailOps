package com.nforce.retailops.exception;

public class InventoryCategoryNotFoundException extends RuntimeException {

    public InventoryCategoryNotFoundException(String message) {
        super(message);
    }
}
