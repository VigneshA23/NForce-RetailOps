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
 * Single source of truth for the session/Remember-Me policy. A session is
 * identified by the JWT's own "jti" claim (the token id) rather than the
 * token string itself, so no raw token is ever persisted.
 *
 * Each session gets an absolute expiry fixed at creation time, chosen from
 * one of two policies (standard / remember-me) — not a sliding inactivity
 * window — so "the session lasts exactly N minutes" is a real guarantee
 * regardless of how active the caller stays in between.
 */
@Service
public class SessionService {

    // Below this, re-touching the row on every request is skipped -- lastActiveAt
    // is kept for observability only (it plays no part in the expiry decision),
    // so minute-level accuracy is enough and this avoids a DB write per request.
    private static final Duration TOUCH_THROTTLE = Duration.ofSeconds(20);

    private final ActiveSessionRepository activeSessionRepository;
    private final long standardSessionMinutes;
    private final long rememberMeSessionMinutes;

    public SessionService(
        ActiveSessionRepository activeSessionRepository,
        @Value("${session.inactivity-timeout-minutes}") long standardSessionMinutes,
        @Value("${session.remember-me-timeout-minutes}") long rememberMeSessionMinutes
    ) {
        this.activeSessionRepository = activeSessionRepository;
        this.standardSessionMinutes = standardSessionMinutes;
        this.rememberMeSessionMinutes = rememberMeSessionMinutes;
    }

    public long getInactivityTimeoutMinutes() {
        return standardSessionMinutes;
    }

    public long getRememberMeTimeoutMinutes() {
        return rememberMeSessionMinutes;
    }

    /** The session lifetime, in minutes, for a login with/without Remember Me. */
    public long resolveSessionMinutes(boolean rememberMe) {
        return rememberMe ? rememberMeSessionMinutes : standardSessionMinutes;
    }

    @Transactional
    public void createSession(String tokenId, String subjectEmail, long sessionMinutes) {
        OffsetDateTime now = OffsetDateTime.now();
        ActiveSession session = new ActiveSession();
        session.setTokenId(tokenId);
        session.setSubjectEmail(subjectEmail);
        session.setLastActiveAt(now);
        session.setExpiresAt(now.plusMinutes(sessionMinutes));
        activeSessionRepository.save(session);
    }

    /**
     * Validates that the session behind this token id is still alive (exists
     * and has not passed its absolute expiry), touching its last-activity
     * timestamp on success. Returns false when the caller must be treated as
     * unauthenticated (revoked via logout, or past its Remember-Me/standard
     * expiry).
     */
    @Transactional
    public boolean validateAndTouch(String tokenId) {
        Optional<ActiveSession> sessionOpt = activeSessionRepository.findByTokenId(tokenId);
        if (sessionOpt.isEmpty()) {
            return false;
        }

        ActiveSession session = sessionOpt.get();
        OffsetDateTime now = OffsetDateTime.now();

        if (!now.isBefore(session.getExpiresAt())) {
            activeSessionRepository.deleteByTokenId(tokenId);
            return false;
        }

        if (Duration.between(session.getLastActiveAt(), now).compareTo(TOUCH_THROTTLE) > 0) {
            activeSessionRepository.touch(tokenId, now);
        }

        return true;
    }

    /**
     * How many seconds remain before this session's absolute expiry, clamped
     * to zero. Used only to seed the frontend's UX countdown accurately after
     * a page refresh -- the value returned here has no effect on enforcement,
     * which is decided solely by validateAndTouch above.
     */
    @Transactional(readOnly = true)
    public Optional<Long> getRemainingSeconds(String tokenId) {
        return activeSessionRepository.findByTokenId(tokenId)
            .map(session -> Math.max(0, Duration.between(OffsetDateTime.now(), session.getExpiresAt()).getSeconds()));
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

    // Same as invalidateAllForUser, but keeps the caller's own current session alive --
    // used for "log out from all other devices" so the user isn't signed out of the
    // tab/device they just made the change from.
    @Transactional
    public void invalidateAllForUserExcept(String email, String exceptTokenId) {
        activeSessionRepository.deleteBySubjectEmailAndTokenIdNot(email, exceptTokenId);
    }
}
