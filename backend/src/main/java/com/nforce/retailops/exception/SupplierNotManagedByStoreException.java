package com.nforce.retailops.exception;

// An Owner/Admin tried to rename, deactivate or delete a supplier that other
// stores also use. Only Super Admin may change a shared supplier; the owner
// can still "Remove from my store" (hide) it.
public class SupplierNotManagedByStoreException extends RuntimeException {
    public SupplierNotManagedByStoreException(String message) {
        super(message);
    }
}
