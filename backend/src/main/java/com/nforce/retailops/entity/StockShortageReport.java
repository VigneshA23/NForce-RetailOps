package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

// One employee mid-day shortage report: the usable stock they said was left.
// Append-only; feeds the Inventory Counts history as a "Shortage reported" entry.
@Entity
@Table(name = "stock_shortage_reports")
public class StockShortageReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_inventory_item_id", nullable = false)
    private StoreInventoryItem storeInventoryItem;

    @Column(name = "check_date", nullable = false)
    private LocalDate checkDate;

    @Column(name = "reported_usable", nullable = false)
    private BigDecimal reportedUsable;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reported_by_user_id", nullable = false)
    private User reportedBy;

    @Column(name = "reported_at", nullable = false)
    private OffsetDateTime reportedAt;

    private String note;

    @PrePersist
    protected void onCreate() {
        if (reportedAt == null) {
            reportedAt = OffsetDateTime.now();
        }
    }

    public Long getId() { return id; }

    public Store getStore() { return store; }
    public void setStore(Store store) { this.store = store; }

    public StoreInventoryItem getStoreInventoryItem() { return storeInventoryItem; }
    public void setStoreInventoryItem(StoreInventoryItem storeInventoryItem) { this.storeInventoryItem = storeInventoryItem; }

    public LocalDate getCheckDate() { return checkDate; }
    public void setCheckDate(LocalDate checkDate) { this.checkDate = checkDate; }

    public BigDecimal getReportedUsable() { return reportedUsable; }
    public void setReportedUsable(BigDecimal reportedUsable) { this.reportedUsable = reportedUsable; }

    public User getReportedBy() { return reportedBy; }
    public void setReportedBy(User reportedBy) { this.reportedBy = reportedBy; }

    public OffsetDateTime getReportedAt() { return reportedAt; }
    public void setReportedAt(OffsetDateTime reportedAt) { this.reportedAt = reportedAt; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
}
