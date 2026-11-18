package com.nforce.retailops.exception;

/**
 * The store an Owner/Admin has selected (the X-Store-Id header) is not one
 * they are actively linked to, or they have several stores and have not picked
 * one. Mapped to 404, never 403, so an unauthorised store looks the same as one
 * that does not exist. The body carries a {@code code} so the UI can tell this
 * apart from an ordinary "not found" and send the admin back to the store picker.
 * Extends StoreNotFoundException so callers that already treat a missing store
 * as "not found" keep doing so; the more specific handler wins in
 * GlobalExceptionHandler.
 */
public class StoreScopeInvalidException extends StoreNotFoundException {

    public static final String CODE = "STORE_SCOPE_INVALID";

    public StoreScopeInvalidException() {
        super("Store not found");
    }
}
