package com.nforce.retailops.repository;

import com.nforce.retailops.entity.ActiveSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;

public interface ActiveSessionRepository extends JpaRepository<ActiveSession, Long> {

    Optional<ActiveSession> findByTokenId(String tokenId);

    @Modifying
    @Transactional
    void deleteByTokenId(String tokenId);

    @Modifying
    @Transactional
    @Query("update ActiveSession s set s.lastActiveAt = :now where s.tokenId = :tokenId")
    int touch(String tokenId, OffsetDateTime now);
}
