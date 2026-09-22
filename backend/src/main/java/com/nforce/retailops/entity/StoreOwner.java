package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "store_owners")
public class StoreOwner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false, unique = true)
    private Store store;

    // Nullable: a store can exist with no owner yet (Super Admin creates it
    // up front, active = false, and it surfaces as a reassignable store when
    // a new owner is created later -- see StoreService.createUnownedStore).
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User owner;

    // Whether THIS owner currently has access to THIS store -- distinct from
    // Store.active, which is reserved for the store's own open/closed status
    // (a separate feature). Revoking access here leaves the store record and
    // its code untouched so it can be handed to a new owner later.
    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    // Set the moment this link loses its active owner (deactivation, or access
    // revoked); cleared back to null the moment it gets an active owner again.
    // Drives the 24-hour "still no Owner/Admin" Super Admin notification in
    // SuperAdminAlertService.runOwnerVacancyCheck.
    @Column(name = "owner_vacant_since")
    private OffsetDateTime ownerVacantSince;

    // The owner who most recently held this link, kept even after `owner` is
    // cleared to null on release (see V60 migration). Never cleared once set --
    // it is a read-side fallback for the employee checklist only and plays no
    // part in reassignment/vacancy logic, which must keep treating a released
    // store as ownerless.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "last_owner_id")
    private User lastOwner;

    public StoreOwner() {
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

    public Store getStore() {
        return store;
    }

    public void setStore(Store store) {
        this.store = store;
    }

    public User getOwner() {
        return owner;
    }

    public void setOwner(User owner) {
        this.owner = owner;
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

    public OffsetDateTime getOwnerVacantSince() {
        return ownerVacantSince;
    }

    public void setOwnerVacantSince(OffsetDateTime ownerVacantSince) {
        this.ownerVacantSince = ownerVacantSince;
    }

    public User getLastOwner() {
        return lastOwner;
    }

    public void setLastOwner(User lastOwner) {
        this.lastOwner = lastOwner;
    }

    // The owner id whose tasks/categories an employee should see for this store:
    // the live owner while the link is active, otherwise whoever last held it,
    // so the checklist doesn't go empty just because the store is temporarily
    // ownerless. Null only for a store that has genuinely never had an owner,
    // or whose access is revoked while the owner reference is kept (a distinct,
    // intentional "suspended" state -- see OwnerManagementService.setStoreActive).
    public Long resolveTaskOwnerId() {
        if (active && owner != null) {
            return owner.getId();
        }
        if (owner == null && lastOwner != null) {
            return lastOwner.getId();
        }
        return null;
    }
}
