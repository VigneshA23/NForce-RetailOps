package com.nforce.retailops.exception;

/** A password reset whose new password is the account's current one (400). */
public class PasswordReuseException extends RuntimeException {
    public PasswordReuseException(String message) {
        super(message);
    }
}
