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

    // Exactly one of flaggedByUser (an Owner/Admin) / flaggedBySuperAdmin.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flagged_by_user_id")
    private User flaggedByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flagged_by_super_admin_id")
    private SuperAdmin flaggedBySuperAdmin;

    @Column(name = "flagged_at", nullable = false)
    private OffsetDateTime flaggedAt;

    @Column(name = "comment_updated_at")
    private OffsetDateTime commentUpdatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolved_by_super_admin_id")
    private SuperAdmin resolvedBySuperAdmin;

    // Set when an Owner/Admin removes the flag or the employee fixes the entry.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolved_by_user_id")
    private User resolvedByUser;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    // REMOVED (admin took the flag off), CORRECTED (an admin corrected the
    // entry) or EMPLOYEE_FIXED (the entering employee corrected it).
    @Column(name = "resolution", length = 20)
    private String resolution;

    public DailyCashEntryFlag() {
    }

    public Long getId() { return id; }
    public DailyCashEntry getEntry() { return entry; }
    public void setEntry(DailyCashEntry entry) { this.entry = entry; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public User getNotifiedUser() { return notifiedUser; }
    public void setNotifiedUser(User notifiedUser) { this.notifiedUser = notifiedUser; }
    public User getFlaggedByUser() { return flaggedByUser; }
    public void setFlaggedByUser(User v) { this.flaggedByUser = v; }
    public User getResolvedByUser() { return resolvedByUser; }
    public void setResolvedByUser(User v) { this.resolvedByUser = v; }
    public String getResolution() { return resolution; }
    public void setResolution(String v) { this.resolution = v; }
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
