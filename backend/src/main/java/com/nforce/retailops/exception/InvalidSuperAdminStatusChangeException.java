package com.nforce.retailops.exception;

// A Super Admin status change that would break the revocation rules: a Super
// Admin deactivating themselves, or leaving no active Super Admin at all.
public class InvalidSuperAdminStatusChangeException extends RuntimeException {
    public InvalidSuperAdminStatusChangeException(String message) {
        super(message);
    }
}
