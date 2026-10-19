package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

// An employee's received-stock report, or a lower-than-expected count, held
// for the store's Owner/Admin to decide. A request with holdsSnapshot=true
// also carries the submitted count itself (pendingAvailable/pendingDeadStock):
// stock_checks and order_list_entries are not touched until it is approved,
// and nothing happens on rejection (the figures are kept on the row only as a
// record of what was turned down). orderListEntry is the existing Ordered
// order the employee said was received, or null for stock not on any order.
@Entity
@Table(name = "stock_receipt_requests")
public class StockReceiptRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_inventory_item_id", nullable = false)
    private StoreInventoryItem storeInventoryItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_list_entry_id")
    private OrderListEntry orderListEntry;

    @Column(name = "check_date", nullable = false)
    private LocalDate checkDate;

    @Column(nullable = false)
    private BigDecimal quantity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StockReceiptRequestStatus status = StockReceiptRequestStatus.PENDING;

    // Which count the request was raised with. A Start of Day restock is already
    // inside that count, so approving it must not add to the day's received total.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StockCheckSnapshot snapshot = StockCheckSnapshot.END_OF_DAY;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_type", nullable = false, length = 20)
    private StockReceiptRequestType type = StockReceiptRequestType.RESTOCK;

    // LOWER_COUNT only: the employee's reason for a count below yesterday's.
    private String reason;

    // Set only on the one request of a submission that holds back a count
    // (holdsSnapshot=true): the available/dead stock the employee submitted,
    // not yet written to stock_checks. Applied on approval, discarded (left
    // here as a record of what was rejected) on rejection. A sibling delivery
    // request from the same submission (e.g. a second order received at once)
    // keeps holdsSnapshot=false and is unaffected -- it still only applies its
    // own delivery via applyApprovedDelivery.
    @Column(name = "pending_available")
    private BigDecimal pendingAvailable;

    @Column(name = "pending_dead_stock")
    private BigDecimal pendingDeadStock;

    @Column(name = "holds_snapshot", nullable = false)
    private boolean holdsSnapshot = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_user_id", nullable = false)
    private User requestedBy;

    @Column(name = "requested_at", nullable = false)
    private OffsetDateTime requestedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by_user_id")
    private User decidedBy;

    @Column(name = "decided_at")
    private OffsetDateTime decidedAt;

    @PrePersist
    protected void onCreate() {
        if (requestedAt == null) {
            requestedAt = OffsetDateTime.now();
        }
    }

    public boolean isPending() { return status == StockReceiptRequestStatus.PENDING; }

    public Long getId() { return id; }

    public Store getStore() { return store; }
    public void setStore(Store store) { this.store = store; }

    public StoreInventoryItem getStoreInventoryItem() { return storeInventoryItem; }
    public void setStoreInventoryItem(StoreInventoryItem storeInventoryItem) { this.storeInventoryItem = storeInventoryItem; }

    public OrderListEntry getOrderListEntry() { return orderListEntry; }
    public void setOrderListEntry(OrderListEntry orderListEntry) { this.orderListEntry = orderListEntry; }

    public LocalDate getCheckDate() { return checkDate; }
    public void setCheckDate(LocalDate checkDate) { this.checkDate = checkDate; }

    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }

    public StockCheckSnapshot getSnapshot() { return snapshot; }
    public void setSnapshot(StockCheckSnapshot snapshot) { this.snapshot = snapshot; }

    public StockReceiptRequestType getType() { return type; }
    public void setType(StockReceiptRequestType type) { this.type = type; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public BigDecimal getPendingAvailable() { return pendingAvailable; }
    public void setPendingAvailable(BigDecimal pendingAvailable) { this.pendingAvailable = pendingAvailable; }

    public BigDecimal getPendingDeadStock() { return pendingDeadStock; }
    public void setPendingDeadStock(BigDecimal pendingDeadStock) { this.pendingDeadStock = pendingDeadStock; }

    public boolean isHoldsSnapshot() { return holdsSnapshot; }
    public void setHoldsSnapshot(boolean holdsSnapshot) { this.holdsSnapshot = holdsSnapshot; }

    public StockReceiptRequestStatus getStatus() { return status; }
    public void setStatus(StockReceiptRequestStatus status) { this.status = status; }

    public User getRequestedBy() { return requestedBy; }
    public void setRequestedBy(User requestedBy) { this.requestedBy = requestedBy; }

    public OffsetDateTime getRequestedAt() { return requestedAt; }

    public User getDecidedBy() { return decidedBy; }
    public void setDecidedBy(User decidedBy) { this.decidedBy = decidedBy; }

    public OffsetDateTime getDecidedAt() { return decidedAt; }
    public void setDecidedAt(OffsetDateTime decidedAt) { this.decidedAt = decidedAt; }
}
