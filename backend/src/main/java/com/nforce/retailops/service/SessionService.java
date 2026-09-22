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
 * Each session's expiry is a sliding inactivity window, chosen from one of
 * two policies at login (standard / remember-me): every touch pushes
 * expiresAt forward by that same window length, so an actively-used session
 * never gets logged out mid-activity, and only lapses after that many
 * minutes with no requests at all.
 */
@Service
public class SessionService {

    // Below this, re-touching the row on every request is skipped -- a
    // request within a few seconds of the last one can't meaningfully change
    // whether the session is still active, so this avoids a DB write per
    // request while keeping sliding-expiry accuracy well within a minute.
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
     * and has not passed its expiry), and — on success — slides that expiry
     * forward by the session's original window length so continued activity
     * keeps it alive. Returns false when the caller must be treated as
     * unauthenticated (revoked via logout, or past its Remember-Me/standard
     * idle window).
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
            // The session's window length was never persisted as its own column;
            // it's recovered here as the gap between the last touch and the
            // expiry that touch set, which this update then reproduces around
            // `now` -- so the same standard/remember-me window keeps sliding
            // forward indefinitely without needing extra storage.
            Duration window = Duration.between(session.getLastActiveAt(), session.getExpiresAt());
            activeSessionRepository.touch(tokenId, now, now.plus(window));
        }

        return true;
    }

    /**
     * How many seconds remain before this session's (sliding) expiry,
     * clamped to zero. Used only to seed the frontend's UX countdown
     * accurately after a page refresh -- the value returned here has no
     * effect on enforcement, which is decided solely by validateAndTouch
     * above.
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
