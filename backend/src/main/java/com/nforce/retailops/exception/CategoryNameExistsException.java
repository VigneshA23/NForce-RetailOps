package com.nforce.retailops.exception;

public class CategoryNameExistsException extends RuntimeException {

    public CategoryNameExistsException(String message) {
        super(message);
    }
}
