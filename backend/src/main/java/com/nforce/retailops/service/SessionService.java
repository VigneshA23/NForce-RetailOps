package com.nforce.retailops.service;

import com.nforce.retailops.entity.ActiveSession;
import com.nforce.retailops.repository.ActiveSessionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * Single source of truth for the global inactivity-timeout session policy.
 * A session is identified by the JWT's own "jti" claim (the token id) rather
 * than the token string itself, so no raw token is ever persisted.
 */
@Service
public class SessionService {

    // Below this, re-touching the row on every request is skipped — the expiry
    // check only needs minute-level accuracy, so this avoids a DB write per request.
    private static final Duration TOUCH_THROTTLE = Duration.ofSeconds(20);

    private final ActiveSessionRepository activeSessionRepository;
    private final long inactivityTimeoutMinutes;

    public SessionService(
        ActiveSessionRepository activeSessionRepository,
        @Value("${session.inactivity-timeout-minutes}") long inactivityTimeoutMinutes
    ) {
        this.activeSessionRepository = activeSessionRepository;
        this.inactivityTimeoutMinutes = inactivityTimeoutMinutes;
    }

    public long getInactivityTimeoutMinutes() {
        return inactivityTimeoutMinutes;
    }

    @Transactional
    public void createSession(String tokenId, String subjectEmail) {
        ActiveSession session = new ActiveSession();
        session.setTokenId(tokenId);
        session.setSubjectEmail(subjectEmail);
        activeSessionRepository.save(session);
    }

    /**
     * Validates that the session behind this token id is still alive (exists and
     * has not exceeded the inactivity timeout), touching its last-activity
     * timestamp on success. Returns false when the caller must be treated as
     * unauthenticated (revoked via logout, or expired due to inactivity).
     */
    @Transactional
    public boolean validateAndTouch(String tokenId) {
        Optional<ActiveSession> sessionOpt = activeSessionRepository.findByTokenId(tokenId);
        if (sessionOpt.isEmpty()) {
            return false;
        }

        ActiveSession session = sessionOpt.get();
        OffsetDateTime now = OffsetDateTime.now();
        Duration idle = Duration.between(session.getLastActiveAt(), now);

        if (idle.toMinutes() >= inactivityTimeoutMinutes) {
            activeSessionRepository.deleteByTokenId(tokenId);
            return false;
        }

        if (idle.compareTo(TOUCH_THROTTLE) > 0) {
            activeSessionRepository.touch(tokenId, now);
        }

        return true;
    }

    @Transactional
    public void invalidate(String tokenId) {
        activeSessionRepository.deleteByTokenId(tokenId);
    }

    /**
     * Revokes every session belonging to one user, across however many devices
     * they are signed in on. Used when an account is deactivated or deleted --
     * that has to take effect on their next request, not whenever each of their
     * tokens happens to expire.
     */
    @Transactional
    public void invalidateAllForUser(String email) {
        activeSessionRepository.deleteBySubjectEmail(email);
    }
}
