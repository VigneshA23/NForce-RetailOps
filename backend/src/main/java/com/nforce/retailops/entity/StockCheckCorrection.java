package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

// Immutable, append-only audit trail for Owner/Admin corrections to a past
// StockCheck. admin_corrections can't be reused here -- its FK to
// task_response_id is hard and NOT NULL, with no polymorphic entity
// reference. One row is written per correction; a StockCheck's history view
// resolves "the original value" from the earliest row and "who corrected it
// (most recently)" from the latest.
@Entity
@Table(name = "stock_check_corrections")
public class StockCheckCorrection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stock_check_id", nullable = false)
    private StockCheck stockCheck;

    @Column(name = "original_count", nullable = false)
    private int originalCount;

    @Column(name = "corrected_count", nullable = false)
    private int correctedCount;

    // Only OWNER_ADMIN can reach correctCheck, so this is always a real
    // users row -- unlike admin_corrections there's no Super-Admin-with-no-
    // user-row case to accommodate here.
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
