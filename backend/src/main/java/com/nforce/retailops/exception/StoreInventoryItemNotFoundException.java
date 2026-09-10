package com.nforce.retailops.exception;

// Thrown both when the row truly doesn't exist and when it exists but
// belongs to another owner's store -- handled as 403 (not 404) since the
// caller is authenticated as an owner, just not this one's.
public class StoreInventoryItemNotFoundException extends RuntimeException {

    public StoreInventoryItemNotFoundException(String message) {
        super(message);
    }
}
