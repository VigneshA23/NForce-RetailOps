package com.nforce.retailops.dto;

import com.nforce.retailops.entity.OrderListEntry;

import java.time.OffsetDateTime;

public record OrderListEntryResponse(
    Long id,
    Long storeInventoryItemId,
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
    OffsetDateTime updatedAt,
    Long imageId
) {
    public static OrderListEntryResponse from(OrderListEntry entry) {
        return new OrderListEntryResponse(
            entry.getId(),
            entry.getStoreInventoryItem().getId(),
            entry.getStoreInventoryItem().getName(),
            entry.getStoreInventoryItem().getUnitOfMeasurement(),
            entry.getQuantityNeeded(),
            entry.getSupplier() != null ? entry.getSupplier().getId() : null,
            entry.getSupplier() != null ? entry.getSupplier().getName() : null,
            entry.getNote(),
            entry.getStatus().name(),
            entry.isAdHoc(),
            entry.getRaisedBy() != null ? entry.getRaisedBy().getFullName() : null,
            entry.getCreatedAt(),
            entry.getUpdatedAt(),
            entry.getStoreInventoryItem().getImageId()
        );
    }
}
