package com.nforce.retailops.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

// One row per emailed password-reset or account-setup link. Only the SHA-256
// of the token is stored (RTS-495, see ResetTokenHashing); the raw token exists
// only in the link itself. The legacy plaintext `token` column is deliberately
// not mapped: V111 cleared it and it is dropped in a later migration.
@Entity
@Table(name = "password_reset_tokens")
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String email;

    @Column(name = "token_hash", nullable = false, unique = true, columnDefinition = "TEXT")
    private String tokenHash;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "used_at")
    private OffsetDateTime usedAt;

    protected PasswordResetToken() {}

    public PasswordResetToken(String email, String tokenHash, OffsetDateTime createdAt, OffsetDateTime expiresAt) {
        this.email = email;
        this.tokenHash = tokenHash;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getTokenHash() { return tokenHash; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
    public OffsetDateTime getUsedAt() { return usedAt; }
    public void setUsedAt(OffsetDateTime usedAt) { this.usedAt = usedAt; }

    public boolean isExpired() { return OffsetDateTime.now().isAfter(expiresAt); }
    public boolean isUsed() { return usedAt != null; }
}
