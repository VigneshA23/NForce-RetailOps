package com.nforce.retailops.exception;

public class InventoryItemAlreadyAssignedException extends RuntimeException {

    public InventoryItemAlreadyAssignedException(String message) {
        super(message);
    }
}
