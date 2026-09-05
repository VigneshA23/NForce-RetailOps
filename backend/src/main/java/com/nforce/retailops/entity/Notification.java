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

import java.time.OffsetDateTime;

@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_user_id", nullable = false)
    private User recipientUser;

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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "related_issue_id")
    private RaisedIssue relatedIssue;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }

    public User getRecipientUser() { return recipientUser; }
    public void setRecipientUser(User recipientUser) { this.recipientUser = recipientUser; }

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

    public OffsetDateTime getCreatedAt() { return createdAt; }
}
