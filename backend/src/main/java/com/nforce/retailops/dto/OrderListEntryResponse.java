package com.nforce.retailops.dto;

import com.nforce.retailops.entity.OrderListEntry;

import java.time.OffsetDateTime;

public record OrderListEntryResponse(
    Long id,
    Long inventoryItemId,
    String itemName,
    String unitOfMeasurement,
    int quantityNeeded,
    Long supplierId,
    String supplierName,
    String note,
    String status,
    boolean adHoc,
    String raisedByName,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
    public static OrderListEntryResponse from(OrderListEntry entry) {
        return new OrderListEntryResponse(
            entry.getId(),
            entry.getInventoryItem().getId(),
            entry.getInventoryItem().getName(),
            entry.getInventoryItem().getUnitOfMeasurement(),
            entry.getQuantityNeeded(),
            entry.getSupplier() != null ? entry.getSupplier().getId() : null,
            entry.getSupplier() != null ? entry.getSupplier().getName() : null,
            entry.getNote(),
            entry.getStatus().name(),
            entry.isAdHoc(),
            entry.getRaisedBy() != null ? entry.getRaisedBy().getFullName() : null,
            entry.getCreatedAt(),
            entry.getUpdatedAt()
        );
    }
}
