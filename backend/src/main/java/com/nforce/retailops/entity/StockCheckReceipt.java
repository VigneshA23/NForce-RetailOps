package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

// One delivery (an order marked Received) against a store inventory item.
// Append-only; feeds the Inventory Counts history as a "Stock received" entry.
// stockCheck is the day's row the delivery was added to, null when the item
// had no row that day -- then countAfter is the latest count plus this
// delivery, and the Inventory Counts view adds it on top of that count until
// a newer count supersedes it. Exactly one of receivedByUser /
// receivedBySuperAdmin is set (a Super Admin has no users row).
@Entity
@Table(name = "stock_check_receipts")
public class StockCheckReceipt {

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
    @JoinColumn(name = "stock_check_id")
    private StockCheck stockCheck;

    @Column(name = "quantity", nullable = false)
    private BigDecimal quantity;

    @Column(name = "count_after", nullable = false)
    private BigDecimal countAfter;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "received_by_user_id")
    private User receivedByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "received_by_super_admin_id")
    private SuperAdmin receivedBySuperAdmin;

    @Column(name = "received_at", nullable = false)
    private OffsetDateTime receivedAt;

    @PrePersist
    protected void onCreate() {
        if (receivedAt == null) {
            receivedAt = OffsetDateTime.now();
        }
    }

    public Long getId() { return id; }

    public Store getStore() { return store; }
    public void setStore(Store store) { this.store = store; }

    public StoreInventoryItem getStoreInventoryItem() { return storeInventoryItem; }
    public void setStoreInventoryItem(StoreInventoryItem storeInventoryItem) { this.storeInventoryItem = storeInventoryItem; }

    public StockCheck getStockCheck() { return stockCheck; }
    public void setStockCheck(StockCheck stockCheck) { this.stockCheck = stockCheck; }

    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }

    public BigDecimal getCountAfter() { return countAfter; }
    public void setCountAfter(BigDecimal countAfter) { this.countAfter = countAfter; }

    public User getReceivedByUser() { return receivedByUser; }
    public void setReceivedByUser(User receivedByUser) { this.receivedByUser = receivedByUser; }

    public SuperAdmin getReceivedBySuperAdmin() { return receivedBySuperAdmin; }
    public void setReceivedBySuperAdmin(SuperAdmin receivedBySuperAdmin) { this.receivedBySuperAdmin = receivedBySuperAdmin; }

    public OffsetDateTime getReceivedAt() { return receivedAt; }
    public void setReceivedAt(OffsetDateTime receivedAt) { this.receivedAt = receivedAt; }

    // Total of deliveries not added to any row that arrived after the latest
    // count was first taken: a count taken after a delivery already includes
    // it, so only later ones still need adding on top.
    public static BigDecimal pendingTotal(Iterable<StockCheckReceipt> unapplied, StockCheck latest) {
        BigDecimal total = BigDecimal.ZERO;
        for (StockCheckReceipt receipt : unapplied) {
            if (latest == null || latest.getCreatedAt() == null || receipt.getReceivedAt().isAfter(latest.getCreatedAt())) {
                total = total.add(receipt.getQuantity());
            }
        }
        return total;
    }

    // Name of whoever received the delivery.
    public String receivedByName() {
        if (receivedByUser != null) {
            return receivedByUser.getFullName();
        }
        return receivedBySuperAdmin != null ? receivedBySuperAdmin.getName() : null;
    }
}
