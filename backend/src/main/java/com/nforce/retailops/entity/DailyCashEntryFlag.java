package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

// One row per flag raised on a cash entry. At most one row is unresolved
// per entry (partial unique index, V116); resolving sets resolvedAt rather
// than deleting, so the history survives and a later flag starts a new row.
@Entity
@Table(name = "daily_cash_entry_flags")
public class DailyCashEntryFlag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "daily_cash_entry_id", nullable = false)
    private DailyCashEntry entry;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String comment;

    // The employee who entered the flagged version. Captured at flag time so
    // the audit trail still names them even if they later leave the store.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "notified_user_id")
    private User notifiedUser;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "flagged_by_super_admin_id", nullable = false)
    private SuperAdmin flaggedBySuperAdmin;

    @Column(name = "flagged_at", nullable = false)
    private OffsetDateTime flaggedAt;

    @Column(name = "comment_updated_at")
    private OffsetDateTime commentUpdatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolved_by_super_admin_id")
    private SuperAdmin resolvedBySuperAdmin;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    public DailyCashEntryFlag() {
    }

    public Long getId() { return id; }
    public DailyCashEntry getEntry() { return entry; }
    public void setEntry(DailyCashEntry entry) { this.entry = entry; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public User getNotifiedUser() { return notifiedUser; }
    public void setNotifiedUser(User notifiedUser) { this.notifiedUser = notifiedUser; }
    public SuperAdmin getFlaggedBySuperAdmin() { return flaggedBySuperAdmin; }
    public void setFlaggedBySuperAdmin(SuperAdmin v) { this.flaggedBySuperAdmin = v; }
    public OffsetDateTime getFlaggedAt() { return flaggedAt; }
    public void setFlaggedAt(OffsetDateTime flaggedAt) { this.flaggedAt = flaggedAt; }
    public OffsetDateTime getCommentUpdatedAt() { return commentUpdatedAt; }
    public void setCommentUpdatedAt(OffsetDateTime v) { this.commentUpdatedAt = v; }
    public SuperAdmin getResolvedBySuperAdmin() { return resolvedBySuperAdmin; }
    public void setResolvedBySuperAdmin(SuperAdmin v) { this.resolvedBySuperAdmin = v; }
    public OffsetDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(OffsetDateTime resolvedAt) { this.resolvedAt = resolvedAt; }

    public boolean isOpen() { return resolvedAt == null; }
}
