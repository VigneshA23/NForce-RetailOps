package com.nforce.retailops.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_user_id")
    private User recipientUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_super_admin_id")
    private SuperAdmin recipientSuperAdmin;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(nullable = false, length = 30)
    private String category;

    @Column(nullable = false, length = 20)
    private String priority = "NORMAL";

    @Column(name = "link_path", length = 255)
    private String linkPath;

    @Column(name = "read", nullable = false)
    private boolean read = false;

    @Column(name = "dedup_key", length = 120)
    private String dedupKey;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "related_issue_id")
    private RaisedIssue relatedIssue;

    // Set on Super Admin store-scoped alerts (e.g. STORE_ZERO_ACTIVITY) so the
    // frontend can deep-link straight into that store's checklist instead of
    // landing on an empty "select a store" picker.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id")
    private Store store;

    // Set on STOCK_RECEIPT_REQUEST notifications so the Notifications page can
    // show the request and let the admin approve or reject it in place.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stock_receipt_request_id")
    private StockReceiptRequest stockReceiptRequest;

    // Set on MISSED_END_OF_DAY notices: the business day whose End of Day counts
    // are missing. The items are looked up live for (store, this date).
    @Column(name = "missed_eod_date")
    private LocalDate missedEodDate;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }

    public User getRecipientUser() { return recipientUser; }
    public void setRecipientUser(User recipientUser) { this.recipientUser = recipientUser; }

    public SuperAdmin getRecipientSuperAdmin() { return recipientSuperAdmin; }
    public void setRecipientSuperAdmin(SuperAdmin recipientSuperAdmin) { this.recipientSuperAdmin = recipientSuperAdmin; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }

    public String getLinkPath() { return linkPath; }
    public void setLinkPath(String linkPath) { this.linkPath = linkPath; }

    public RaisedIssue getRelatedIssue() { return relatedIssue; }
    public void setRelatedIssue(RaisedIssue relatedIssue) { this.relatedIssue = relatedIssue; }

    public StockReceiptRequest getStockReceiptRequest() { return stockReceiptRequest; }
    public void setStockReceiptRequest(StockReceiptRequest stockReceiptRequest) { this.stockReceiptRequest = stockReceiptRequest; }

    public Store getStore() { return store; }
    public void setStore(Store store) { this.store = store; }

    public String getDedupKey() { return dedupKey; }
    public void setDedupKey(String dedupKey) { this.dedupKey = dedupKey; }

    public LocalDate getMissedEodDate() { return missedEodDate; }
    public void setMissedEodDate(LocalDate missedEodDate) { this.missedEodDate = missedEodDate; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
}
