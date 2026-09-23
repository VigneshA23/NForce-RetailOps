package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * A pending (or resolved) move of a past missed task instance
 * (task_id, store_id, past_date) onto a target date (linked_date, today or up
 * to 7 days out) as its own independent completion unit. See
 * TaskMakeupLinkService for the full lifecycle (PENDING -> FULFILLED /
 * EXPIRED / CANCELLED).
 */
@Entity
@Table(name = "task_makeup_links")
public class TaskMakeupLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Column(name = "past_date", nullable = false)
    private LocalDate pastDate;

    @Column(name = "linked_date", nullable = false)
    private LocalDate linkedDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private MakeupLinkStatus status = MakeupLinkStatus.PENDING;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolved_by")
    private User resolvedBy;

    public TaskMakeupLink() {
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public Task getTask() {
        return task;
    }

    public void setTask(Task task) {
        this.task = task;
    }

    public Store getStore() {
        return store;
    }

    public void setStore(Store store) {
        this.store = store;
    }

    public LocalDate getPastDate() {
        return pastDate;
    }

    public void setPastDate(LocalDate pastDate) {
        this.pastDate = pastDate;
    }

    public LocalDate getLinkedDate() {
        return linkedDate;
    }

    public void setLinkedDate(LocalDate linkedDate) {
        this.linkedDate = linkedDate;
    }

    public User getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(User createdBy) {
        this.createdBy = createdBy;
    }

    public MakeupLinkStatus getStatus() {
        return status;
    }

    public void setStatus(MakeupLinkStatus status) {
        this.status = status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(OffsetDateTime resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public User getResolvedBy() {
        return resolvedBy;
    }

    public void setResolvedBy(User resolvedBy) {
        this.resolvedBy = resolvedBy;
    }
}
