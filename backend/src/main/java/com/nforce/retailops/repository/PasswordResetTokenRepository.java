package com.nforce.retailops.repository;

import com.nforce.retailops.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByToken(UUID token);

    @Query("SELECT COUNT(t) FROM PasswordResetToken t WHERE t.email = :email AND t.createdAt > :since")
    long countByEmailSince(@Param("email") String email, @Param("since") OffsetDateTime since);
}
