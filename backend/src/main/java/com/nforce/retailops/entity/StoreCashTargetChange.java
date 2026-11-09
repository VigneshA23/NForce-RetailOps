package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

// Immutable, append-only audit row for one change to a store's cash target.
// Exactly one of changedByUser / changedBySuperAdmin is set (the
// StockCheckCorrection actor pattern).
@Entity
@Table(name = "store_cash_target_changes")
public class StoreCashTargetChange {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Column(name = "previous_amount", nullable = false)
    private BigDecimal previousAmount;

    @Column(name = "new_amount", nullable = false)
    private BigDecimal newAmount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by_user_id")
    private User changedByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by_super_admin_id")
    private SuperAdmin changedBySuperAdmin;

    @Column(name = "changed_at", nullable = false)
    private OffsetDateTime changedAt;

    public Long getId() { return id; }
    public Store getStore() { return store; }
    public void setStore(Store store) { this.store = store; }
    public BigDecimal getPreviousAmount() { return previousAmount; }
    public void setPreviousAmount(BigDecimal v) { this.previousAmount = v; }
    public BigDecimal getNewAmount() { return newAmount; }
    public void setNewAmount(BigDecimal v) { this.newAmount = v; }
    public User getChangedByUser() { return changedByUser; }
    public void setChangedByUser(User u) { this.changedByUser = u; }
    public SuperAdmin getChangedBySuperAdmin() { return changedBySuperAdmin; }
    public void setChangedBySuperAdmin(SuperAdmin s) { this.changedBySuperAdmin = s; }
    public OffsetDateTime getChangedAt() { return changedAt; }
    public void setChangedAt(OffsetDateTime t) { this.changedAt = t; }
}
