package com.nforce.retailops.repository;

import com.nforce.retailops.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByToken(UUID token);

    @Query("SELECT COUNT(t) FROM PasswordResetToken t WHERE t.email = :email AND t.createdAt > :since")
    long countByEmailSince(@Param("email") String email, @Param("since") OffsetDateTime since);

    // Atomic single-use claim: only one concurrent caller can flip used_at from
    // NULL, so the affected-row count (1 = winner, 0 = loser) decides the race.
    @Modifying(flushAutomatically = true)
    @Query("UPDATE PasswordResetToken t SET t.usedAt = :usedAt "
        + "WHERE t.token = :token AND t.usedAt IS NULL AND t.expiresAt > :now")
    int markUsedIfUnused(@Param("token") UUID token,
                         @Param("usedAt") OffsetDateTime usedAt,
                         @Param("now") OffsetDateTime now);

    // Supersede earlier links when a new one is issued. Rows are marked used, not
    // deleted, because countByEmailSince counts them for the hourly rate limit.
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE PasswordResetToken t SET t.usedAt = :now "
        + "WHERE lower(t.email) = lower(:email) AND t.usedAt IS NULL")
    int invalidateOutstandingForEmail(@Param("email") String email,
                                      @Param("now") OffsetDateTime now);

    // Tokens are keyed by email, so when an account's email changes the links
    // issued to the old address are removed -- otherwise they would work for
    // whoever is later given that address.
    @Modifying
    @Query("DELETE FROM PasswordResetToken t WHERE lower(t.email) = lower(:email)")
    void deleteByEmailIgnoreCase(@Param("email") String email);
}
