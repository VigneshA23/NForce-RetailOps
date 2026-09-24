package com.nforce.retailops.exception;

public class IssueAlreadyResolvedException extends RuntimeException {
    public IssueAlreadyResolvedException(String message) {
        super(message);
    }
}
