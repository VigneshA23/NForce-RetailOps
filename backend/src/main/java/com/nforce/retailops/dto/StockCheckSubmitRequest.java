package com.nforce.retailops.dto;

import com.nforce.retailops.entity.StockCheckSnapshot;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

// Employee saving today's Start of Day or End of Day count for one item.
// Saving the same snapshot again updates it in place.
//
// quantityReceived is only for End of Day: stock delivered today that the
// employee confirms when the closing count is higher than the opening one. It is
// added to today's received total in the same save, so usage is worked out
// against it. Null or zero means nothing was received.
//
// Reported stock is not applied on save: it becomes a pending request the
// store's Owner/Admin approves. receivedOrderEntryId names an existing Ordered
// order the employee says arrived; with it, quantityReceived may be left out
// and defaults to the quantity ordered.
public record StockCheckSubmitRequest(
    @NotNull(message = "Store is required")
    Long storeId,

    @NotNull(message = "Store item is required")
    Long storeInventoryItemId,

    @NotNull(message = "Choose Start of Day or End of Day")
    StockCheckSnapshot snapshot,

    @NotNull(message = "Available stock is required")
    @DecimalMin(value = "0", message = "Available stock cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
    BigDecimal available,

    @NotNull(message = "Dead stock is required")
    @DecimalMin(value = "0", message = "Dead stock cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
    BigDecimal deadStock,

    @DecimalMin(value = "0", message = "Received stock cannot be negative")
    @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
    BigDecimal quantityReceived,

    Long receivedOrderEntryId,

    @Valid
    List<ReceivedItem> receivedItems
) {
    // One thing the employee says arrived: an existing Ordered order
    // (orderEntryId set; quantity defaults to what was ordered) or new stock
    // not on any order (orderEntryId null). The employee may report several at
    // once, e.g. new stock plus one or more orders.
    public record ReceivedItem(
        Long orderEntryId,

        @DecimalMin(value = "0", message = "Received stock cannot be negative")
        @Digits(integer = 10, fraction = 2, message = "Use at most 2 decimal places")
        BigDecimal quantity
    ) {
    }

    public StockCheckSubmitRequest(Long storeId, Long storeInventoryItemId, StockCheckSnapshot snapshot, BigDecimal available, BigDecimal deadStock, BigDecimal quantityReceived, Long receivedOrderEntryId) {
        this(storeId, storeInventoryItemId, snapshot, available, deadStock, quantityReceived, receivedOrderEntryId, null);
    }

    public StockCheckSubmitRequest(Long storeId, Long storeInventoryItemId, StockCheckSnapshot snapshot, BigDecimal available, BigDecimal deadStock, BigDecimal quantityReceived) {
        this(storeId, storeInventoryItemId, snapshot, available, deadStock, quantityReceived, null, null);
    }

    public StockCheckSubmitRequest(Long storeId, Long storeInventoryItemId, StockCheckSnapshot snapshot, BigDecimal available, BigDecimal deadStock) {
        this(storeId, storeInventoryItemId, snapshot, available, deadStock, null, null, null);
    }

    // receivedItems, or the single legacy quantityReceived / receivedOrderEntryId pair.
    public List<ReceivedItem> deliveries() {
        if (receivedItems != null && !receivedItems.isEmpty()) {
            return receivedItems;
        }
        boolean legacy = receivedOrderEntryId != null || (quantityReceived != null && quantityReceived.signum() > 0);
        return legacy ? List.of(new ReceivedItem(receivedOrderEntryId, quantityReceived)) : List.of();
    }
}
