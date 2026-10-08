package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

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

    // Nullable -- items created before V77 have none until edited.
    @Column(length = 40)
    private String category;

    @Column(name = "min_weekday")
    private BigDecimal minWeekday;

    // Nullable -- falls back to minWeekday when not separately configured.
    @Column(name = "min_weekend")
    private BigDecimal minWeekend;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "preferred_supplier_id")
    private Supplier preferredSupplier;

    @Column(columnDefinition = "TEXT")
    private String note;

    // Display image picked from Unsplash; null until one is chosen. Lazy so
    // reading getImageId() never loads the bytes.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "image_id")
    private InventoryItemImage image;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "auto_po_enabled", nullable = false)
    private boolean autoPoEnabled = true;

    // Shared by every store's copy of an item Super Admin created for several
    // stores at once; null otherwise. Copies stay independently editable.
    @Column(name = "item_group_id")
    private UUID itemGroupId;

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

    public UUID getItemGroupId() {
        return itemGroupId;
    }

    public void setItemGroupId(UUID itemGroupId) {
        this.itemGroupId = itemGroupId;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public BigDecimal getMinWeekday() {
        return minWeekday;
    }

    public void setMinWeekday(BigDecimal minWeekday) {
        this.minWeekday = minWeekday;
    }

    public BigDecimal getMinWeekend() {
        return minWeekend;
    }

    public void setMinWeekend(BigDecimal minWeekend) {
        this.minWeekend = minWeekend;
    }

    // The minimum that applies on a given day: the weekend minimum on
    // Saturday/Sunday when one is set, otherwise the weekday minimum. Shared
    // by the employee stock check and the Owner/Admin inventory table so the
    // two can't disagree about what's required today.
    public BigDecimal requiredMinimumOn(LocalDate date) {
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

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public InventoryItemImage getImage() {
        return image;
    }

    public void setImage(InventoryItemImage image) {
        this.image = image;
    }

    // Reads the id off the lazy proxy without initialising it.
    public Long getImageId() {
        return image != null ? image.getId() : null;
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
