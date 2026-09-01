package com.nforce.retailops.exception;

public class InvalidTaskResponseException extends RuntimeException {
    public InvalidTaskResponseException(String message) {
        super(message);
    }
}
