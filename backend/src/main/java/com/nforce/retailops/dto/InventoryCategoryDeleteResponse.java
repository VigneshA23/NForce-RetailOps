package com.nforce.retailops.dto;

// deleted: the category row was removed. Otherwise an item still uses it and
// it was only marked inactive (deactivated = true).
public record InventoryCategoryDeleteResponse(boolean deleted, boolean deactivated) {
}
