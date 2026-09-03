package com.nforce.retailops.exception;

public class InvalidCategoryOrderException extends RuntimeException {

    public InvalidCategoryOrderException(String message) {
        super(message);
    }
}
