package com.nforce.retailops.exception;

public class InventoryCategoryNameExistsException extends RuntimeException {

    public InventoryCategoryNameExistsException(String message) {
        super(message);
    }
}
