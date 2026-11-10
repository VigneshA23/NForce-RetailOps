package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

// Per-store target cash-drawer amount, one row per store. The default
// (150.00) is the DB column default (V109), never set from Java:
// targetAmount is excluded from the INSERT and read back afterwards by the
// service. Do NOT mark it @Generated: Hibernate then also excludes it from
// UPDATE and saved changes silently never reach the database.
@Entity
@Table(name = "store_cash_targets")
public class StoreCashTarget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "store_id", nullable = false, unique = true)
    private Store store;

    @Column(name = "target_amount", nullable = false, insertable = false, updatable = true,
        columnDefinition = "NUMERIC(12,2) DEFAULT 150.00")
    private BigDecimal targetAmount;

    // Both null while the target is still the untouched default.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_user_id")
    private User updatedByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_super_admin_id")
    private SuperAdmin updatedBySuperAdmin;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (updatedAt == null) {
            updatedAt = OffsetDateTime.now();
        }
    }

    public Long getId() { return id; }
    public Store getStore() { return store; }
    public void setStore(Store store) { this.store = store; }
    public BigDecimal getTargetAmount() { return targetAmount; }
    public void setTargetAmount(BigDecimal targetAmount) { this.targetAmount = targetAmount; }
    public User getUpdatedByUser() { return updatedByUser; }
    public void setUpdatedByUser(User updatedByUser) { this.updatedByUser = updatedByUser; }
    public SuperAdmin getUpdatedBySuperAdmin() { return updatedBySuperAdmin; }
    public void setUpdatedBySuperAdmin(SuperAdmin s) { this.updatedBySuperAdmin = s; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
