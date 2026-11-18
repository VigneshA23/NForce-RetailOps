package com.nforce.retailops.exception;

/** A change to an existing entry (a direct correction) was submitted without a reason. Mapped to 400. */
public class CorrectionReasonRequiredException extends RuntimeException {
    public CorrectionReasonRequiredException(String message) {
        super(message);
    }
}
