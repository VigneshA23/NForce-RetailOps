package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

// Immutable, append-only audit trail of every edit to a Start of Day or End
// of Day snapshot -- an employee re-saving today's count, an Owner/Admin
// correcting a past one, or (RTS-306) a Super Admin correcting any store's.
// An employee's genuine first save of a snapshot writes no row (who entered
// it lives on StockCheck itself); a correction always writes one, even when
// it's filling in a snapshot that was never recorded -- originalCount is
// null in that case. admin_corrections can't be reused here -- its FK to
// task_response_id is hard and NOT NULL, with no polymorphic entity
// reference. originalCount / correctedCount hold the available figure
// (column names predate dead stock, V71).
@Entity
@Table(name = "stock_check_corrections")
public class StockCheckCorrection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stock_check_id", nullable = false)
    private StockCheck stockCheck;

    @Enumerated(EnumType.STRING)
    @Column(name = "snapshot", nullable = false, length = 16)
    private StockCheckSnapshot snapshot = StockCheckSnapshot.END_OF_DAY;

    // Null when the snapshot had no prior value at all (an Admin correction
    // filling in one that was never recorded) -- distinct from a prior value
    // of 0.
    @Column(name = "original_count")
    private BigDecimal originalCount;

    @Column(name = "corrected_count", nullable = false)
    private BigDecimal correctedCount;

    // Null on rows written before dead stock existed (pre-V76).
    @Column(name = "original_dead_stock")
    private BigDecimal originalDeadStock;

    @Column(name = "corrected_dead_stock")
    private BigDecimal correctedDeadStock;

    // Employees and OWNER_ADMIN are both real users rows; Super Admin is not
    // (its own super_admins table, no FK to users) -- exactly one of
    // correctedByUser/correctedBySuperAdmin is set per row, mirroring
    // RaisedIssue.respondedByUser/respondedBySuperAdmin (V68).
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "corrected_by_user_id")
    private User correctedByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "corrected_by_super_admin_id")
    private SuperAdmin correctedBySuperAdmin;

    @Column(name = "reason", length = 200)
    private String reason;

    @Column(name = "corrected_at", nullable = false)
    private OffsetDateTime correctedAt;

    public StockCheckCorrection() {
    }

    @PrePersist
    protected void onCreate() {
        if (correctedAt == null) {
            correctedAt = OffsetDateTime.now();
        }
    }

    public Long getId() { return id; }

    public StockCheck getStockCheck() { return stockCheck; }
    public void setStockCheck(StockCheck stockCheck) { this.stockCheck = stockCheck; }

    public StockCheckSnapshot getSnapshot() { return snapshot; }
    public void setSnapshot(StockCheckSnapshot snapshot) { this.snapshot = snapshot; }

    public BigDecimal getOriginalDeadStock() { return originalDeadStock; }
    public void setOriginalDeadStock(BigDecimal originalDeadStock) { this.originalDeadStock = originalDeadStock; }

    public BigDecimal getCorrectedDeadStock() { return correctedDeadStock; }
    public void setCorrectedDeadStock(BigDecimal correctedDeadStock) { this.correctedDeadStock = correctedDeadStock; }

    public BigDecimal getOriginalCount() { return originalCount; }
    public void setOriginalCount(BigDecimal originalCount) { this.originalCount = originalCount; }

    public BigDecimal getCorrectedCount() { return correctedCount; }
    public void setCorrectedCount(BigDecimal correctedCount) { this.correctedCount = correctedCount; }

    public User getCorrectedByUser() { return correctedByUser; }
    public void setCorrectedByUser(User correctedByUser) { this.correctedByUser = correctedByUser; }

    public SuperAdmin getCorrectedBySuperAdmin() { return correctedBySuperAdmin; }
    public void setCorrectedBySuperAdmin(SuperAdmin correctedBySuperAdmin) { this.correctedBySuperAdmin = correctedBySuperAdmin; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public OffsetDateTime getCorrectedAt() { return correctedAt; }
    public void setCorrectedAt(OffsetDateTime correctedAt) { this.correctedAt = correctedAt; }
}
