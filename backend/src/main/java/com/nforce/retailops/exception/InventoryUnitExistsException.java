package com.nforce.retailops.exception;

public class InventoryUnitExistsException extends RuntimeException {

    public InventoryUnitExistsException(String message) {
        super(message);
    }
}
