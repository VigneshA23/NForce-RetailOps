package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

// An employee's End of Day report that stock arrived, waiting on the store's
// Owner/Admin. Nothing in stock_checks or order_list_entries changes until it
// is approved. orderListEntry is the existing Ordered order the employee said
// was received, or null for stock that isn't on any order.
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
