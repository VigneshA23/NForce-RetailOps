package com.nforce.retailops.exception;

public class InvalidIssueTransitionException extends RuntimeException {
    public InvalidIssueTransitionException(String message) {
        super(message);
    }
}
