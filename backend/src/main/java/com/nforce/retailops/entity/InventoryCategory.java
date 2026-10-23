package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

// Super Admin-managed inventory category catalog, assigned to specific
// stores or All Stores -- same appliesToAllStores/join-table shape as
// Supplier. Distinct from the store_inventory_items.category free-text
// field (an item's own, unrestricted category label) and from the
// per-owner `categories` table used for task categories.
@Entity
@Table(name = "inventory_categories")
public class InventoryCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String name;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "applies_to_all_stores", nullable = false)
    private boolean appliesToAllStores;

    @ManyToMany
    @JoinTable(
        name = "inventory_category_stores",
        joinColumns = @JoinColumn(name = "category_id"),
        inverseJoinColumns = @JoinColumn(name = "store_id")
    )
    private Set<Store> stores = new HashSet<>();

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public InventoryCategory() {
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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public boolean isAppliesToAllStores() {
        return appliesToAllStores;
    }

    public void setAppliesToAllStores(boolean appliesToAllStores) {
        this.appliesToAllStores = appliesToAllStores;
    }

    public Set<Store> getStores() {
        return stores;
    }

    public void setStores(Set<Store> stores) {
        this.stores = stores;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
