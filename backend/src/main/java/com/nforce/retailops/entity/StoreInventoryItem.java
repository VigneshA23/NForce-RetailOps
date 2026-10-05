package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;

// A store's own inventory item (Phase 2). Fully store-scoped: name, unit
// and note all live here directly rather than on a shared global
// catalog, so the same product name can exist independently in multiple
// stores with different configuration. Created/edited/deleted directly by
// either Super Admin (any store) or that store's Owner/Admin (their own
// store only) -- see StoreInventoryItemService.
@Entity
@Table(name = "store_inventory_items")
public class StoreInventoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String name;

    @Column(name = "unit_of_measurement", nullable = false, columnDefinition = "TEXT")
    private String unitOfMeasurement;

    @Column(name = "min_weekday")
    private Integer minWeekday;

    // Nullable -- falls back to minWeekday when not separately configured.
    @Column(name = "min_weekend")
    private Integer minWeekend;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "preferred_supplier_id")
    private Supplier preferredSupplier;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private InventoryCategory category;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "auto_po_enabled", nullable = false)
    private boolean autoPoEnabled = true;

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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getUnitOfMeasurement() {
        return unitOfMeasurement;
    }

    public void setUnitOfMeasurement(String unitOfMeasurement) {
        this.unitOfMeasurement = unitOfMeasurement;
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

    // The minimum that applies on a given day: the weekend minimum on
    // Saturday/Sunday when one is set, otherwise the weekday minimum. Shared
    // by the employee stock check and the Owner/Admin inventory table so the
    // two can't disagree about what's required today.
    public Integer requiredMinimumOn(LocalDate date) {
        DayOfWeek day = date.getDayOfWeek();
        boolean weekend = day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY;
        if (weekend && minWeekend != null) {
            return minWeekend;
        }
        return minWeekday;
    }

    public Supplier getPreferredSupplier() {
        return preferredSupplier;
    }

    public void setPreferredSupplier(Supplier preferredSupplier) {
        this.preferredSupplier = preferredSupplier;
    }

    public InventoryCategory getCategory() {
        return category;
    }

    public void setCategory(InventoryCategory category) {
        this.category = category;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public boolean isAutoPoEnabled() {
        return autoPoEnabled;
    }

    public void setAutoPoEnabled(boolean autoPoEnabled) {
        this.autoPoEnabled = autoPoEnabled;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
