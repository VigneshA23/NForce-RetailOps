package com.nforce.retailops.exception;

// Raised when an order is created or received for an inventory item that no
// employee has ever stock-checked: there is no count to order against or to
// add a delivery onto.
public class ItemNotCountedException extends RuntimeException {
    public ItemNotCountedException(String message) {
        super(message);
    }
}
