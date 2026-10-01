package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

// Immutable, append-only audit trail of every edit to an existing Start of
// Day or End of Day snapshot -- an employee re-saving today's count, or
// Owner/Admin correcting a past one. The first save of a snapshot writes no
// row (who entered it lives on StockCheck itself). admin_corrections can't
// be reused here -- its FK to task_response_id is hard and NOT NULL, with no
// polymorphic entity reference. originalCount / correctedCount hold the
// available figure (column names predate dead stock, V71).
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

    @Column(name = "original_count", nullable = false)
    private int originalCount;

    @Column(name = "corrected_count", nullable = false)
    private int correctedCount;

    // Null on rows written before dead stock existed (pre-V76).
    @Column(name = "original_dead_stock")
    private Integer originalDeadStock;

    @Column(name = "corrected_dead_stock")
    private Integer correctedDeadStock;

    // Employees and OWNER_ADMIN are both real users rows -- Super Admin
    // can't reach either edit path, so unlike admin_corrections there's no
    // no-user-row case to accommodate here.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "corrected_by_user_id", nullable = false)
    private User correctedBy;

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

    public Integer getOriginalDeadStock() { return originalDeadStock; }
    public void setOriginalDeadStock(Integer originalDeadStock) { this.originalDeadStock = originalDeadStock; }

    public Integer getCorrectedDeadStock() { return correctedDeadStock; }
    public void setCorrectedDeadStock(Integer correctedDeadStock) { this.correctedDeadStock = correctedDeadStock; }

    public int getOriginalCount() { return originalCount; }
    public void setOriginalCount(int originalCount) { this.originalCount = originalCount; }

    public int getCorrectedCount() { return correctedCount; }
    public void setCorrectedCount(int correctedCount) { this.correctedCount = correctedCount; }

    public User getCorrectedBy() { return correctedBy; }
    public void setCorrectedBy(User correctedBy) { this.correctedBy = correctedBy; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public OffsetDateTime getCorrectedAt() { return correctedAt; }
    public void setCorrectedAt(OffsetDateTime correctedAt) { this.correctedAt = correctedAt; }
}
