package com.nforce.retailops.exception;

public class InvalidStockCheckException extends RuntimeException {
    public InvalidStockCheckException(String message) {
        super(message);
    }
}
