package com.nforce.retailops.exception;

/** A daily cash save carried no amount at all. Mapped to 400. */
public class CashEntryAmountsRequiredException extends RuntimeException {
    public CashEntryAmountsRequiredException(String message) {
        super(message);
    }
}
