package com.nforce.retailops.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "login_attempts")
public class LoginAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "attempted_at", nullable = false)
    private OffsetDateTime attemptedAt;

    protected LoginAttempt() {}

    public LoginAttempt(String email) {
        this.email = email;
    }

    @PrePersist
    void prePersist() {
        if (attemptedAt == null) attemptedAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public OffsetDateTime getAttemptedAt() { return attemptedAt; }
}
