package com.nforce.retailops.repository;

import com.nforce.retailops.entity.LoginAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;

public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, Long> {

    @Query("SELECT COUNT(a) FROM LoginAttempt a WHERE a.email = :email AND a.attemptedAt > :since")
    long countByEmailSince(@Param("email") String email, @Param("since") OffsetDateTime since);

    @Modifying
    @Query("DELETE FROM LoginAttempt a WHERE a.email = :email")
    void deleteByEmail(@Param("email") String email);

    @Modifying
    @Query("DELETE FROM LoginAttempt a WHERE a.attemptedAt < :before")
    void deleteOlderThan(@Param("before") OffsetDateTime before);
}
