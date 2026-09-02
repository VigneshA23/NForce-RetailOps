package com.nforce.retailops.exception;

public class TaskAlreadyCompletedException extends RuntimeException {
    public TaskAlreadyCompletedException(String message) {
        super(message);
    }
}
