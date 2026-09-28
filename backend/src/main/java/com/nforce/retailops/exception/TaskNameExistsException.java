package com.nforce.retailops.exception;

public class TaskNameExistsException extends RuntimeException {

    public TaskNameExistsException(String message) {
        super(message);
    }
}
