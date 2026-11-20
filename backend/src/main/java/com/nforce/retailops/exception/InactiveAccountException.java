package com.nforce.retailops.exception;

/**
 * Thrown when someone tries to change an owner, store or employee that is
 * inactive. The only permitted change to an inactive record is reactivating it.
 */
public class InactiveAccountException extends RuntimeException {

    public InactiveAccountException(String kind) {
        super("This " + kind + " is inactive. Activate it before making any other changes.");
    }
}
