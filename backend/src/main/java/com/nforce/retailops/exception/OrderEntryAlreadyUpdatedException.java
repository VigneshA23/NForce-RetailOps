package com.nforce.retailops.exception;

// The caller's view of an order-list entry was stale: someone else (Owner/Admin
// or Super Admin) changed its status after the caller loaded it.
public class OrderEntryAlreadyUpdatedException extends RuntimeException {

    public OrderEntryAlreadyUpdatedException(String message) {
        super(message);
    }
}
