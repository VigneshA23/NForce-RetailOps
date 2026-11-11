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

    // What the link is for (RTS-512). Lets a resent setup link retire earlier
    // setup links without touching a pending password-reset link.
    public enum Purpose { PASSWORD_RESET, ACCOUNT_SETUP }

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Purpose purpose = Purpose.PASSWORD_RESET;

    protected PasswordResetToken() {}

    public PasswordResetToken(String email, String tokenHash, OffsetDateTime createdAt, OffsetDateTime expiresAt) {
        this(email, tokenHash, createdAt, expiresAt, Purpose.PASSWORD_RESET);
    }

    public PasswordResetToken(String email, String tokenHash, OffsetDateTime createdAt,
                              OffsetDateTime expiresAt, Purpose purpose) {
        this.email = email;
        this.tokenHash = tokenHash;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.purpose = purpose;
    }

    public Purpose getPurpose() { return purpose; }

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
