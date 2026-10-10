package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "suppliers")
public class Supplier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String name;

    @Column(nullable = false)
    private boolean active = true;

    @Column(length = 20)
    private String contact;

    @Column(length = 255)
    private String location;

    // Super Admin's own Add/Edit Supplier form only (RTS-304 follow-up) --
    // same appliesToAllStores + join-table model as Category (see
    // entity/Category.java). Backfilled true for suppliers that predate this
    // field, preserving their original "usable by any store" behavior.
    @Column(name = "applies_to_all_stores", nullable = false)
    private boolean appliesToAllStores;

    @ManyToMany
    @JoinTable(
        name = "supplier_stores",
        joinColumns = @JoinColumn(name = "supplier_id"),
        inverseJoinColumns = @JoinColumn(name = "store_id")
    )
    private Set<Store> stores = new HashSet<>();

    // Owner/Admin's own "remove from my store" action (distinct from
    // `stores` above, which is Super Admin's assignment list): a store in
    // this set has chosen to hide this supplier from its own Suppliers tab
    // and preferred-supplier dropdown, without touching the supplier row
    // itself or any other store's view.
    @ManyToMany
    @JoinTable(
        name = "store_hidden_suppliers",
        joinColumns = @JoinColumn(name = "supplier_id"),
        inverseJoinColumns = @JoinColumn(name = "store_id")
    )
    private Set<Store> hiddenAtStores = new HashSet<>();

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public Supplier() {
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

    public String getContact() {
        return contact;
    }

    public void setContact(String contact) {
        this.contact = contact;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
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

    public Set<Store> getHiddenAtStores() {
        return hiddenAtStores;
    }

    public void setHiddenAtStores(Set<Store> hiddenAtStores) {
        this.hiddenAtStores = hiddenAtStores;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
