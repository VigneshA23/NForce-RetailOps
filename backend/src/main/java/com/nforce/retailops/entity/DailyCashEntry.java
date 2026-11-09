package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

// One cash entry per store per business day (unique store+date, V108).
// Re-saving updates in place; the prior values go to DailyCashEntryCorrection.
@Entity
@Table(name = "daily_cash_entries")
public class DailyCashEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Column(name = "business_date", nullable = false)
    private LocalDate businessDate;

    @Column(name = "total_cash_sales", nullable = false)
    private BigDecimal totalCashSales;

    @Column(name = "opening_drawer_cash", nullable = false)
    private BigDecimal openingDrawerCash;

    @Column(name = "cash_removed", nullable = false)
    private BigDecimal cashRemoved;

    // The physically counted end-of-day drawer amount (the "actual cash count").
    @Column(name = "cash_remaining", nullable = false)
    private BigDecimal cashRemaining;

    @Column(name = "cash_expenses", nullable = false)
    private BigDecimal cashExpenses;

    @Column(name = "bank_deposits", nullable = false)
    private BigDecimal bankDeposits;

    // Signed: the only field allowed to be negative.
    @Column(name = "other_adjustments", nullable = false)
    private BigDecimal otherAdjustments;

    // Exactly one of each user/super-admin pair is set (Super Admin is not a
    // users row).
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "entered_by_user_id")
    private User enteredByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "entered_by_super_admin_id")
    private SuperAdmin enteredBySuperAdmin;

    @Column(name = "entered_at", nullable = false)
    private OffsetDateTime enteredAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_user_id")
    private User updatedByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_super_admin_id")
    private SuperAdmin updatedBySuperAdmin;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public DailyCashEntry() {
    }

    public Long getId() { return id; }
    public Store getStore() { return store; }
    public void setStore(Store store) { this.store = store; }
    public LocalDate getBusinessDate() { return businessDate; }
    public void setBusinessDate(LocalDate businessDate) { this.businessDate = businessDate; }
    public BigDecimal getTotalCashSales() { return totalCashSales; }
    public void setTotalCashSales(BigDecimal v) { this.totalCashSales = v; }
    public BigDecimal getOpeningDrawerCash() { return openingDrawerCash; }
    public void setOpeningDrawerCash(BigDecimal v) { this.openingDrawerCash = v; }
    public BigDecimal getCashRemoved() { return cashRemoved; }
    public void setCashRemoved(BigDecimal v) { this.cashRemoved = v; }
    public BigDecimal getCashRemaining() { return cashRemaining; }
    public void setCashRemaining(BigDecimal v) { this.cashRemaining = v; }
    public BigDecimal getCashExpenses() { return cashExpenses; }
    public void setCashExpenses(BigDecimal v) { this.cashExpenses = v; }
    public BigDecimal getBankDeposits() { return bankDeposits; }
    public void setBankDeposits(BigDecimal v) { this.bankDeposits = v; }
    public BigDecimal getOtherAdjustments() { return otherAdjustments; }
    public void setOtherAdjustments(BigDecimal v) { this.otherAdjustments = v; }
    public User getEnteredByUser() { return enteredByUser; }
    public void setEnteredByUser(User v) { this.enteredByUser = v; }
    public SuperAdmin getEnteredBySuperAdmin() { return enteredBySuperAdmin; }
    public void setEnteredBySuperAdmin(SuperAdmin v) { this.enteredBySuperAdmin = v; }
    public OffsetDateTime getEnteredAt() { return enteredAt; }
    public void setEnteredAt(OffsetDateTime enteredAt) { this.enteredAt = enteredAt; }
    public User getUpdatedByUser() { return updatedByUser; }
    public void setUpdatedByUser(User v) { this.updatedByUser = v; }
    public SuperAdmin getUpdatedBySuperAdmin() { return updatedBySuperAdmin; }
    public void setUpdatedBySuperAdmin(SuperAdmin v) { this.updatedBySuperAdmin = v; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
