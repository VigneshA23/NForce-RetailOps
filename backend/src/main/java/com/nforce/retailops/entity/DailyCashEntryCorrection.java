package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

// Immutable, append-only: the values an entry held just before a correction,
// who last wrote them and when, plus who corrected them, when, why (V118), and
// what they were changed to (V118). Follows the
// StockCheckCorrection precedent; admin_corrections cannot be reused.
@Entity
@Table(name = "daily_cash_entry_corrections")
public class DailyCashEntryCorrection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "daily_cash_entry_id", nullable = false)
    private DailyCashEntry entry;

    @Column(name = "previous_total_cash_sales", nullable = false)
    private BigDecimal previousTotalCashSales;
    @Column(name = "previous_opening_drawer_cash", nullable = false)
    private BigDecimal previousOpeningDrawerCash;
    @Column(name = "previous_cash_removed", nullable = false)
    private BigDecimal previousCashRemoved;
    @Column(name = "previous_cash_remaining", nullable = false)
    private BigDecimal previousCashRemaining;
    @Column(name = "previous_cash_expenses", nullable = false)
    private BigDecimal previousCashExpenses;
    @Column(name = "previous_bank_deposits", nullable = false)
    private BigDecimal previousBankDeposits;
    @Column(name = "previous_other_adjustments", nullable = false)
    private BigDecimal previousOtherAdjustments;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "previous_updated_by_user_id")
    private User previousUpdatedByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "previous_updated_by_super_admin_id")
    private SuperAdmin previousUpdatedBySuperAdmin;

    @Column(name = "previous_updated_at", nullable = false)
    private OffsetDateTime previousUpdatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "corrected_by_user_id")
    private User correctedByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "corrected_by_super_admin_id")
    private SuperAdmin correctedBySuperAdmin;

    @Column(name = "corrected_at", nullable = false)
    private OffsetDateTime correctedAt;

    // V118. Null only on corrections saved before that release.
    @Column(name = "reason", length = 500)
    private String reason;
    @Column(name = "new_total_cash_sales")
    private BigDecimal newTotalCashSales;
    @Column(name = "new_opening_drawer_cash")
    private BigDecimal newOpeningDrawerCash;
    @Column(name = "new_cash_removed")
    private BigDecimal newCashRemoved;
    @Column(name = "new_cash_remaining")
    private BigDecimal newCashRemaining;
    @Column(name = "new_cash_expenses")
    private BigDecimal newCashExpenses;
    @Column(name = "new_bank_deposits")
    private BigDecimal newBankDeposits;
    @Column(name = "new_other_adjustments")
    private BigDecimal newOtherAdjustments;

    public DailyCashEntryCorrection() {
    }

    // Snapshots the entry's current (about to be replaced) values.
    // Exactly one of correctedByUser / correctedBySuperAdmin is non-null.
    public static DailyCashEntryCorrection snapshotOf(
        DailyCashEntry e, User correctedByUser, SuperAdmin correctedBySuperAdmin, OffsetDateTime at
    ) {
        DailyCashEntryCorrection c = new DailyCashEntryCorrection();
        c.entry = e;
        c.previousTotalCashSales = e.getTotalCashSales();
        c.previousOpeningDrawerCash = e.getOpeningDrawerCash();
        c.previousCashRemoved = e.getCashRemoved();
        c.previousCashRemaining = e.getCashRemaining();
        c.previousCashExpenses = e.getCashExpenses();
        c.previousBankDeposits = e.getBankDeposits();
        c.previousOtherAdjustments = e.getOtherAdjustments();
        c.previousUpdatedByUser = e.getUpdatedByUser();
        c.previousUpdatedBySuperAdmin = e.getUpdatedBySuperAdmin();
        c.previousUpdatedAt = e.getUpdatedAt();
        c.correctedByUser = correctedByUser;
        c.correctedBySuperAdmin = correctedBySuperAdmin;
        c.correctedAt = at;
        return c;
    }

    public Long getId() { return id; }
    public DailyCashEntry getEntry() { return entry; }
    public BigDecimal getPreviousTotalCashSales() { return previousTotalCashSales; }
    public BigDecimal getPreviousOpeningDrawerCash() { return previousOpeningDrawerCash; }
    public BigDecimal getPreviousCashRemoved() { return previousCashRemoved; }
    public BigDecimal getPreviousCashRemaining() { return previousCashRemaining; }
    public BigDecimal getPreviousCashExpenses() { return previousCashExpenses; }
    public BigDecimal getPreviousBankDeposits() { return previousBankDeposits; }
    public BigDecimal getPreviousOtherAdjustments() { return previousOtherAdjustments; }
    // Call once the entry holds its corrected values, before saving this row.
    public void recordCorrection(DailyCashEntry corrected, String reason) {
        this.reason = reason;
        this.newTotalCashSales = corrected.getTotalCashSales();
        this.newOpeningDrawerCash = corrected.getOpeningDrawerCash();
        this.newCashRemoved = corrected.getCashRemoved();
        this.newCashRemaining = corrected.getCashRemaining();
        this.newCashExpenses = corrected.getCashExpenses();
        this.newBankDeposits = corrected.getBankDeposits();
        this.newOtherAdjustments = corrected.getOtherAdjustments();
    }

    public String getReason() { return reason; }
    public BigDecimal getNewTotalCashSales() { return newTotalCashSales; }
    public BigDecimal getNewOpeningDrawerCash() { return newOpeningDrawerCash; }
    public BigDecimal getNewCashRemoved() { return newCashRemoved; }
    public BigDecimal getNewCashRemaining() { return newCashRemaining; }
    public BigDecimal getNewCashExpenses() { return newCashExpenses; }
    public BigDecimal getNewBankDeposits() { return newBankDeposits; }
    public BigDecimal getNewOtherAdjustments() { return newOtherAdjustments; }
    public User getPreviousUpdatedByUser() { return previousUpdatedByUser; }
    public SuperAdmin getPreviousUpdatedBySuperAdmin() { return previousUpdatedBySuperAdmin; }
    public OffsetDateTime getPreviousUpdatedAt() { return previousUpdatedAt; }
    public User getCorrectedByUser() { return correctedByUser; }
    public SuperAdmin getCorrectedBySuperAdmin() { return correctedBySuperAdmin; }
    public OffsetDateTime getCorrectedAt() { return correctedAt; }
}
