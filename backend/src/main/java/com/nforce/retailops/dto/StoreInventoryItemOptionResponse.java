package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StoreInventoryItem;

// Minimal item shape for the employee's "Report Shortage" item picker --
// backs GET /api/me/inventory/items, which lists every item on the store's
// catalog (active and inactive alike, matching what Owner/Admin sees on the
// Inventory Items tab) rather than just today's active checklist items.
public record StoreInventoryItemOptionResponse(
    Long storeInventoryItemId,
    String itemName,
    String unitOfMeasurement,
    boolean active
) {
    public static StoreInventoryItemOptionResponse from(StoreInventoryItem item) {
        return new StoreInventoryItemOptionResponse(item.getId(), item.getName(), item.getUnitOfMeasurement(), item.isActive());
    }
}
