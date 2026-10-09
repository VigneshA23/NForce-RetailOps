package com.nforce.retailops.dto;

import java.math.BigDecimal;
import com.nforce.retailops.entity.OrderListEntry;

import java.time.OffsetDateTime;

public record OrderListEntryResponse(
    Long id,
    Long storeInventoryItemId,
    String itemName,
    String unitOfMeasurement,
    BigDecimal quantityNeeded,
    BigDecimal manualAddition,
    Long supplierId,
    String supplierName,
    String note,
    String status,
    boolean adHoc,
    String raisedByName,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    Long imageId,
    BigDecimal quantityReceived,
    // Only set on the response to the Ordered -> Received change itself;
    // null on every list read.
    ReceiptOutcome receipt
) {
    // What marking an order received did to the store's stock. stockUpdated is
    // false when there was no stock count for today to add the delivery to
    // (currentStock / shortfall are then null too).
    public record ReceiptOutcome(
        boolean stockUpdated,
        BigDecimal currentStock,
        BigDecimal requiredToday,
        // requiredToday minus currentStock, floored at 0; > 0 means the
        // delivery still leaves the item under today's minimum.
        BigDecimal shortfall
    ) {
    }

    public static OrderListEntryResponse from(OrderListEntry entry) {
        return from(entry, null);
    }

    public static OrderListEntryResponse from(OrderListEntry entry, ReceiptOutcome receipt) {
        return new OrderListEntryResponse(
            entry.getId(),
            entry.getStoreInventoryItem().getId(),
            entry.getStoreInventoryItem().getName(),
            entry.getStoreInventoryItem().getUnitOfMeasurement(),
            entry.getQuantityNeeded(),
            entry.getManualAddition(),
            entry.getSupplier() != null ? entry.getSupplier().getId() : null,
            entry.getSupplier() != null ? entry.getSupplier().getName() : null,
            entry.getNote(),
            entry.getStatus().name(),
            entry.isAdHoc(),
            entry.getRaisedBy() != null ? entry.getRaisedBy().getFullName() : null,
            entry.getCreatedAt(),
            entry.getUpdatedAt(),
            entry.getStoreInventoryItem().getImageId(),
            entry.getQuantityReceived(),
            receipt
        );
    }
}
