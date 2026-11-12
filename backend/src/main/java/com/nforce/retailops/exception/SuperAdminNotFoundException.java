package com.nforce.retailops.exception;

public class SuperAdminNotFoundException extends RuntimeException {
    public SuperAdminNotFoundException(String message) {
        super(message);
    }
}
