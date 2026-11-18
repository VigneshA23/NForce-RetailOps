package com.nforce.retailops.exception;

/**
 * A store already has an active Owner/Admin, so another one cannot be assigned
 * to it until the current one is unassigned. Mapped to 409.
 */
public class StoreAdminConflictException extends RuntimeException {

    public static final String MESSAGE = "An admin is already assigned to this store";

    public StoreAdminConflictException() {
        super(MESSAGE);
    }
}
