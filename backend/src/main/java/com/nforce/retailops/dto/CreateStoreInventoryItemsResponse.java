package com.nforce.retailops.dto;

import java.util.List;

// Result of a Super Admin multi-store create: the copies actually made, and
// the names of selected stores skipped because they already hold an item with
// the same name and category.
public record CreateStoreInventoryItemsResponse(
    List<StoreInventoryItemResponse> created,
    List<String> skippedStoreNames
) {
}
