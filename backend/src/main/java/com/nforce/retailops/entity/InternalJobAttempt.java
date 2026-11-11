package com.nforce.retailops.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/** A failed (wrong or missing) secret attempt against /internal/jobs/**, keyed by caller IP. */
@Entity
@Table(name = "internal_job_attempts")
public class InternalJobAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ip_address", nullable = false)
    private String ipAddress;

    @Column(name = "attempted_at", nullable = false)
    private OffsetDateTime attemptedAt;

    protected InternalJobAttempt() {}

    public InternalJobAttempt(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    @PrePersist
    void prePersist() {
        if (attemptedAt == null) attemptedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public String getIpAddress() { return ipAddress; }
    public OffsetDateTime getAttemptedAt() { return attemptedAt; }
}
