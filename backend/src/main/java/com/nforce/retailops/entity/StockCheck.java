package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;

// One employee's physical count of one store item on one day. quantityNeeded
// is computed AND persisted at submit time so historical records stay
// accurate even if the item's min thresholds change later.
@Entity
@Table(name = "stock_checks")
public class StockCheck {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_inventory_item_id", nullable = false)
    private StoreInventoryItem storeInventoryItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "checked_by_user_id", nullable = false)
    private User checkedBy;

    @Column(name = "check_date", nullable = false)
    private LocalDate checkDate;

    @Column(name = "current_count", nullable = false)
    private int currentCount;

    @Column(name = "quantity_needed", nullable = false)
    private int quantityNeeded;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    public StockCheck() {
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public StoreInventoryItem getStoreInventoryItem() {
        return storeInventoryItem;
    }

    public void setStoreInventoryItem(StoreInventoryItem storeInventoryItem) {
        this.storeInventoryItem = storeInventoryItem;
    }

    public User getCheckedBy() {
        return checkedBy;
    }

    public void setCheckedBy(User checkedBy) {
        this.checkedBy = checkedBy;
    }

    public LocalDate getCheckDate() {
        return checkDate;
    }

    public void setCheckDate(LocalDate checkDate) {
        this.checkDate = checkDate;
    }

    public int getCurrentCount() {
        return currentCount;
    }

    public void setCurrentCount(int currentCount) {
        this.currentCount = currentCount;
    }

    public int getQuantityNeeded() {
        return quantityNeeded;
    }

    public void setQuantityNeeded(int quantityNeeded) {
        this.quantityNeeded = quantityNeeded;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
