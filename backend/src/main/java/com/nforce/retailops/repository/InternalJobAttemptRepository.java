package com.nforce.retailops.repository;

import com.nforce.retailops.entity.InternalJobAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;

public interface InternalJobAttemptRepository extends JpaRepository<InternalJobAttempt, Long> {

    @Query("SELECT COUNT(a) FROM InternalJobAttempt a WHERE a.ipAddress = :ip AND a.attemptedAt > :since")
    long countByIpSince(@Param("ip") String ip, @Param("since") OffsetDateTime since);

    @Modifying
    @Query("DELETE FROM InternalJobAttempt a WHERE a.attemptedAt < :before")
    void deleteOlderThan(@Param("before") OffsetDateTime before);
}
