package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

// Immutable, append-only: the values an entry held just before a correction,
// who last wrote them and when, plus who corrected them, when, why (V118), and
// what they were changed to (V118). The V118 new_total_cash_sales and
// new_bank_deposits columns are retired with those fields (V119) and unmapped. Follows the
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

    @Column(name = "previous_opening_drawer_cash", nullable = false)
    private BigDecimal previousOpeningDrawerCash;
    @Column(name = "previous_cash_removed", nullable = false)
    private BigDecimal previousCashRemoved;
    @Column(name = "previous_cash_remaining", nullable = false)
    private BigDecimal previousCashRemaining;
    @Column(name = "previous_other_adjustments", nullable = false)
    private BigDecimal previousOtherAdjustments;

    // Snapshot of the stored daily expected cash (from the local V120
    // migration that adds daily_expected_cash to daily_cash_entries).
    // Nullable because corrections written before that migration did not
    // record it.
    @Column(name = "previous_daily_expected_cash")
    private BigDecimal previousDailyExpectedCash;

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
    @Column(name = "new_opening_drawer_cash")
    private BigDecimal newOpeningDrawerCash;
    @Column(name = "new_cash_removed")
    private BigDecimal newCashRemoved;
    @Column(name = "new_cash_remaining")
    private BigDecimal newCashRemaining;
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
        c.previousOpeningDrawerCash = e.getOpeningDrawerCash();
        c.previousCashRemoved = e.getCashRemoved();
        c.previousCashRemaining = e.getCashRemaining();
        c.previousOtherAdjustments = e.getOtherAdjustments();
        c.previousDailyExpectedCash = e.getDailyExpectedCash();
        c.previousUpdatedByUser = e.getUpdatedByUser();
        c.previousUpdatedBySuperAdmin = e.getUpdatedBySuperAdmin();
        c.previousUpdatedAt = e.getUpdatedAt();
        c.correctedByUser = correctedByUser;
        c.correctedBySuperAdmin = correctedBySuperAdmin;
        c.correctedAt = at;
        return c;
    }

    // Call once the entry holds its corrected values, before saving this row.
    public void recordCorrection(DailyCashEntry corrected, String reason) {
        this.reason = reason;
        this.newOpeningDrawerCash = corrected.getOpeningDrawerCash();
        this.newCashRemoved = corrected.getCashRemoved();
        this.newCashRemaining = corrected.getCashRemaining();
        this.newOtherAdjustments = corrected.getOtherAdjustments();
    }

    public Long getId() { return id; }
    public DailyCashEntry getEntry() { return entry; }
    public BigDecimal getPreviousOpeningDrawerCash() { return previousOpeningDrawerCash; }
    public BigDecimal getPreviousCashRemoved() { return previousCashRemoved; }
    public BigDecimal getPreviousCashRemaining() { return previousCashRemaining; }
    public BigDecimal getPreviousOtherAdjustments() { return previousOtherAdjustments; }
    public BigDecimal getPreviousDailyExpectedCash() { return previousDailyExpectedCash; }
    public String getReason() { return reason; }
    public BigDecimal getNewOpeningDrawerCash() { return newOpeningDrawerCash; }
    public BigDecimal getNewCashRemoved() { return newCashRemoved; }
    public BigDecimal getNewCashRemaining() { return newCashRemaining; }
    public BigDecimal getNewOtherAdjustments() { return newOtherAdjustments; }
    public User getPreviousUpdatedByUser() { return previousUpdatedByUser; }
    public SuperAdmin getPreviousUpdatedBySuperAdmin() { return previousUpdatedBySuperAdmin; }
    public OffsetDateTime getPreviousUpdatedAt() { return previousUpdatedAt; }
    public User getCorrectedByUser() { return correctedByUser; }
    public SuperAdmin getCorrectedBySuperAdmin() { return correctedBySuperAdmin; }
    public OffsetDateTime getCorrectedAt() { return correctedAt; }
}
