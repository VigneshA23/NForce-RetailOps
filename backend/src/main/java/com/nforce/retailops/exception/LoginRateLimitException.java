package com.nforce.retailops.exception;

public class LoginRateLimitException extends RuntimeException {
    public LoginRateLimitException(String message) {
        super(message);
    }
}
