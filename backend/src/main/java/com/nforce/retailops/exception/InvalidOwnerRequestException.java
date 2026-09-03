package com.nforce.retailops.exception;

public class InvalidOwnerRequestException extends RuntimeException {
    public InvalidOwnerRequestException(String message) {
        super(message);
    }
}
