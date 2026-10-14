package com.nforce.retailops.dto;

import com.nforce.retailops.entity.OrderListEntry;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

// One line of the Order History / Purchasing Report's Detailed view: an
// Ordered or Received entry (never Needs Ordering -- that status never
// reaches this report), with both the ordered and received date/by so a
// shortfall or a slow delivery is visible without cross-referencing anything
// else. storeId/storeName are only meaningful for Super Admin's cross-store
// report; Owner/Admin's own is always one store, but the fields are populated
// either way rather than left null for one caller.
public record OrderHistoryEntryResponse(
    Long id,
    Long storeInventoryItemId,
    String itemName,
    String category,
    String unitOfMeasurement,
    Long imageId,
    Long supplierId,
    String supplierName,
    BigDecimal quantityOrdered,
    BigDecimal quantityReceived,
    String status,
    OffsetDateTime orderedAt,
    String orderedByName,
    OffsetDateTime receivedAt,
    String receivedByName,
    Long storeId,
    String storeName
) {
    public static OrderHistoryEntryResponse from(OrderListEntry entry) {
        return new OrderHistoryEntryResponse(
            entry.getId(),
            entry.getStoreInventoryItem().getId(),
            entry.getStoreInventoryItem().getName(),
            entry.getStoreInventoryItem().getCategory(),
            entry.getStoreInventoryItem().getUnitOfMeasurement(),
            entry.getStoreInventoryItem().getImageId(),
            entry.getSupplier() != null ? entry.getSupplier().getId() : null,
            // Same "No Supplier" substitution as the Purchasing Summary
            // (OrderListService.NO_SUPPLIER) -- independently declared there
            // too, following this codebase's existing per-class duplication
            // of that literal rather than a shared constant.
            entry.getSupplier() != null ? entry.getSupplier().getName() : "No Supplier",
            entry.totalQuantityOrdered(),
            entry.getQuantityReceived(),
            entry.getStatus().name(),
            entry.getOrderedAt(),
            entry.getOrderedByName(),
            entry.getReceivedAt(),
            entry.getReceivedByName(),
            entry.getStore().getId(),
            entry.getStore().getName()
        );
    }
}
