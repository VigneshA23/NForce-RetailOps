package com.nforce.retailops.dto;

import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.StockReceiptRequest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

// What the admin needs to decide a received-stock request. kind tells the two
// cases apart: NEW_STOCK (not on any order) or EXISTING_ORDER (an Ordered
// order the employee says arrived), in which case the order* fields identify it.
public record StockReceiptRequestResponse(
    Long id,
    String kind,
    String status,
    String itemName,
    String unit,
    BigDecimal quantity,
    LocalDate checkDate,
    String requestedByName,
    String storeName,
    Long orderId,
    BigDecimal orderedQuantity,
    String orderSupplierName,
    OffsetDateTime orderedAt,
    String decidedByName,
    OffsetDateTime decidedAt,
    String type,
    String snapshot,
    String reason
) {
    public static StockReceiptRequestResponse from(StockReceiptRequest r) {
        OrderListEntry order = r.getOrderListEntry();
        return new StockReceiptRequestResponse(
            r.getId(),
            r.getType() == com.nforce.retailops.entity.StockReceiptRequestType.LOWER_COUNT
                ? "LOWER_COUNT" : order != null ? "EXISTING_ORDER" : "NEW_STOCK",
            r.getStatus().name(),
            r.getStoreInventoryItem().getName(),
            r.getStoreInventoryItem().getUnitOfMeasurement(),
            r.getQuantity(),
            r.getCheckDate(),
            r.getRequestedBy().getFullName(),
            r.getStore().getName(),
            order != null ? order.getId() : null,
            order != null ? order.totalQuantityOrdered() : null,
            order != null && order.getSupplier() != null ? order.getSupplier().getName() : null,
            order != null ? order.getOrderedAt() : null,
            r.getDecidedBy() != null ? r.getDecidedBy().getFullName() : null,
            r.getDecidedAt(),
            r.getType().name(),
            r.getSnapshot().name(),
            r.getReason()
        );
    }
}
