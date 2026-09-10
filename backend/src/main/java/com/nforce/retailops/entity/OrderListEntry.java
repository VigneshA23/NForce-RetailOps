package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

// References InventoryItem directly (not StoreInventoryItem) so an order
// survives even if Super Admin later deactivates the item's store
// assignment while it's still ORDERED. At most one active (status !=
// RECEIVED) row per store+item is enforced by a partial unique index
// (V49) -- outstanding entries never disappear on their own.
@Entity
@Table(name = "order_list_entries")
public class OrderListEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inventory_item_id", nullable = false)
    private InventoryItem inventoryItem;

    @Column(name = "quantity_needed", nullable = false)
    private int quantityNeeded;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderStatus status = OrderStatus.NEEDS_ORDERING;

    @Column(name = "ad_hoc", nullable = false)
    private boolean adHoc;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "raised_by_user_id")
    private User raisedBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public OrderListEntry() {
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

    public int getQuantityNeeded() {
        return quantityNeeded;
    }

    public void setQuantityNeeded(int quantityNeeded) {
        this.quantityNeeded = quantityNeeded;
    }

    public Supplier getSupplier() {
        return supplier;
    }

    public void setSupplier(Supplier supplier) {
        this.supplier = supplier;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
    }

    public boolean isAdHoc() {
        return adHoc;
    }

    public void setAdHoc(boolean adHoc) {
        this.adHoc = adHoc;
    }

    public User getRaisedBy() {
        return raisedBy;
    }

    public void setRaisedBy(User raisedBy) {
        this.raisedBy = raisedBy;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
