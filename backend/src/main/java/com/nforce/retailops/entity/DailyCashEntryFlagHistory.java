package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

// Append-only trail of every Super Admin action on a cash entry flag:
// raising it, editing the comment, removing it, or resolving via correction.
@Entity
@Table(name = "daily_cash_entry_flag_history")
public class DailyCashEntryFlagHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "daily_cash_entry_id", nullable = false)
    private DailyCashEntry entry;

    // Nullable only on legacy or orphaned rows -- in practice every write
    // sets it to the flag the action touched.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flag_id")
    private DailyCashEntryFlag flag;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 20)
    private DailyCashEntryFlagAction action;

    @Column(name = "previous_comment", columnDefinition = "TEXT")
    private String previousComment;

    @Column(name = "new_comment", columnDefinition = "TEXT")
    private String newComment;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_super_admin_id", nullable = false)
    private SuperAdmin actorSuperAdmin;

    @Column(name = "recorded_at", nullable = false)
    private OffsetDateTime recordedAt;

    public DailyCashEntryFlagHistory() {
    }

    public static DailyCashEntryFlagHistory of(
        DailyCashEntryFlag flag,
        DailyCashEntryFlagAction action,
        String previousComment,
        String newComment,
        SuperAdmin actor,
        OffsetDateTime at
    ) {
        DailyCashEntryFlagHistory h = new DailyCashEntryFlagHistory();
        h.entry = flag.getEntry();
        h.flag = flag;
        h.action = action;
        h.previousComment = previousComment;
        h.newComment = newComment;
        h.actorSuperAdmin = actor;
        h.recordedAt = at;
        return h;
    }

    public Long getId() { return id; }
    public DailyCashEntry getEntry() { return entry; }
    public DailyCashEntryFlag getFlag() { return flag; }
    public DailyCashEntryFlagAction getAction() { return action; }
    public String getPreviousComment() { return previousComment; }
    public String getNewComment() { return newComment; }
    public SuperAdmin getActorSuperAdmin() { return actorSuperAdmin; }
    public OffsetDateTime getRecordedAt() { return recordedAt; }
}
