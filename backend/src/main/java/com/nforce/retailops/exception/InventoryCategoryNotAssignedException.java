package com.nforce.retailops.exception;

// An Owner/Admin tried to save an item with a category that Super Admin has
// not assigned to their store -- the UI only ever offers assigned categories,
// so this is a server-side backstop against a crafted request.
public class InventoryCategoryNotAssignedException extends RuntimeException {

    public InventoryCategoryNotAssignedException(String message) {
        super(message);
    }
}
