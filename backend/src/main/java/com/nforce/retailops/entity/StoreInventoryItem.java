package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

// Assignment of a global InventoryItem to a specific Store. Super Admin
// creates this row (the assignment); Owner/Admin only ever updates
// minWeekday/minWeekend/preferredSupplier on it -- they never create or
// delete the assignment itself.
@Entity
@Table(name = "store_inventory_items")
public class StoreInventoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_item_id", nullable = false)
    private InventoryItem inventoryItem;

    @Column(name = "min_weekday")
    private Integer minWeekday;

    // Nullable -- falls back to minWeekday when not separately configured.
    @Column(name = "min_weekend")
    private Integer minWeekend;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "preferred_supplier_id")
    private Supplier preferredSupplier;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public StoreInventoryItem() {
    }

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Store getStore() {
        return store;
    }

    public void setStore(Store store) {
        this.store = store;
    }

    public InventoryItem getInventoryItem() {
        return inventoryItem;
    }

    public void setInventoryItem(InventoryItem inventoryItem) {
        this.inventoryItem = inventoryItem;
    }

    public Integer getMinWeekday() {
        return minWeekday;
    }

    public void setMinWeekday(Integer minWeekday) {
        this.minWeekday = minWeekday;
    }

    public Integer getMinWeekend() {
        return minWeekend;
    }

    public void setMinWeekend(Integer minWeekend) {
        this.minWeekend = minWeekend;
    }

    public Supplier getPreferredSupplier() {
        return preferredSupplier;
    }

    public void setPreferredSupplier(Supplier preferredSupplier) {
        this.preferredSupplier = preferredSupplier;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
