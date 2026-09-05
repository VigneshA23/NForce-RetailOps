package com.nforce.retailops.exception;

public class IssueNotFoundException extends RuntimeException {
    public IssueNotFoundException(String message) {
        super(message);
    }
}
