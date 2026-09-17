package com.nforce.retailops.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

// One row per platform action worth surfacing in "Recent Activity" (Super Admin:
// every row; Owner Admin: rows scoped to their own store(s) via storeId). actorName
// and storeName are denormalized plain text -- deliberately not @ManyToOne FKs to
// User/Store -- so a log entry stays readable after the actor or store is later
// renamed, deactivated, or deleted.
@Entity
@Table(name = "activity_log")
public class ActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "action_type", nullable = false, length = 50)
    private String actionType;

    @Column(name = "actor_name", nullable = false, length = 150)
    private String actorName;

    // 'OWNER_ADMIN' | 'SUPER_ADMIN' | 'EMPLOYEE'
    @Column(name = "actor_role", nullable = false, length = 20)
    private String actorRole;

    // Null for platform-level events with no single store (e.g. an admin account
    // created before any store is assigned) -- excluded from every Owner Admin's
    // feed, visible only to Super Admin's.
    @Column(name = "store_id")
    private Long storeId;

    @Column(name = "store_name", length = 150)
    private String storeName;

    @Column(name = "entity_type", length = 50)
    private String entityType;

    @Column(name = "entity_name", length = 200)
    private String entityName;

    @Column(name = "description", nullable = false, length = 300)
    private String description;

    @Column(name = "occurred_at", nullable = false)
    private OffsetDateTime occurredAt;

    public ActivityLog() {
    }

    @PrePersist
    protected void onCreate() {
        if (occurredAt == null) {
            occurredAt = OffsetDateTime.now();
        }
    }

    public Long getId() { return id; }

    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }

    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }

    public String getActorRole() { return actorRole; }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }

    public Long getStoreId() { return storeId; }
    public void setStoreId(Long storeId) { this.storeId = storeId; }

    public String getStoreName() { return storeName; }
    public void setStoreName(String storeName) { this.storeName = storeName; }

    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }

    public String getEntityName() { return entityName; }
    public void setEntityName(String entityName) { this.entityName = entityName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public OffsetDateTime getOccurredAt() { return occurredAt; }
    public void setOccurredAt(OffsetDateTime occurredAt) { this.occurredAt = occurredAt; }
}
