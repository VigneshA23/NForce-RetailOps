package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

// References the store's own inventory item directly. At most one active
// (status != RECEIVED) row per store+item is enforced by a partial unique
// index (V49/V70) -- outstanding entries never disappear on their own. An
// item with outstanding order history can't be hard-deleted (see
// StoreInventoryItemService), so this reference always stays resolvable.
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
    @JoinColumn(name = "store_inventory_item_id", nullable = false)
    private StoreInventoryItem storeInventoryItem;

    @Column(name = "quantity_needed", nullable = false)
    private int quantityNeeded;

    // Extra quantity a person added by hand on top of quantityNeeded (via
    // "Add to order" on an item that already has an active entry), not a
    // replacement for it -- the two are shown as separate figures on the
    // Order List, and the real quantity to order is their sum. Reset to 0
    // whenever quantityNeeded is next recalculated from a fresh stock count
    // (see OrderListService.doUpsertShortage) -- a manual top-up only ever
    // applies to that day's figure, not indefinitely.
    @Column(name = "manual_addition", nullable = false)
    private int manualAddition;

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

    public StoreInventoryItem getStoreInventoryItem() {
        return storeInventoryItem;
    }

    public void setStoreInventoryItem(StoreInventoryItem storeInventoryItem) {
        this.storeInventoryItem = storeInventoryItem;
    }

    public int getQuantityNeeded() {
        return quantityNeeded;
    }

    public void setQuantityNeeded(int quantityNeeded) {
        this.quantityNeeded = quantityNeeded;
    }

    public int getManualAddition() {
        return manualAddition;
    }

    public void setManualAddition(int manualAddition) {
        this.manualAddition = manualAddition;
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
