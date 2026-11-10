package com.nforce.retailops.service;

import com.nforce.retailops.entity.PrincipalType;
import com.nforce.retailops.entity.ActiveSession;
import com.nforce.retailops.repository.ActiveSessionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SessionServiceTest {

    private static final String EMAIL = "user@nforce.test";

    @Mock
    private ActiveSessionRepository activeSessionRepository;

    private SessionService sessionService(long standardMinutes, long rememberMeMinutes) {
        return new SessionService(activeSessionRepository, standardMinutes, rememberMeMinutes);
    }

    @Test
    void reportsConfiguredTimeoutsBackVerbatim() {
        SessionService service = sessionService(30, 240);
        assertThat(service.getInactivityTimeoutMinutes()).isEqualTo(30);
        assertThat(service.getRememberMeTimeoutMinutes()).isEqualTo(240);
    }

    @Test
    void resolveSessionMinutesPicksThePolicyMatchingRememberMe() {
        SessionService service = sessionService(30, 240);
        assertThat(service.resolveSessionMinutes(false)).isEqualTo(30);
        assertThat(service.resolveSessionMinutes(true)).isEqualTo(240);
    }

    @Test
    void unknownTokenIdIsNotValid() {
        when(activeSessionRepository.findByTokenId("missing")).thenReturn(Optional.empty());

        assertThat(sessionService(30, 240).validateAndTouch("missing", EMAIL)).isFalse();
    }

    @Test
    void sessionWellWithinItsExpiryIsValid() {
        ActiveSession session = new ActiveSession();
        session.setTokenId("tok-1");
        session.setSubjectEmail(EMAIL);
        session.setLastActiveAt(OffsetDateTime.now());
        session.setExpiresAt(OffsetDateTime.now().plusMinutes(25));
        when(activeSessionRepository.findByTokenId("tok-1")).thenReturn(Optional.of(session));

        assertThat(sessionService(30, 240).validateAndTouch("tok-1", EMAIL)).isTrue();
        verify(activeSessionRepository, never()).deleteByTokenId(anyString());
    }

    @Test
    void activeSessionPastTheTouchThrottleSlidesItsExpiryForwardByTheOriginalWindow() {
        OffsetDateTime lastActiveAt = OffsetDateTime.now().minusMinutes(1);
        ActiveSession session = new ActiveSession();
        session.setTokenId("tok-slide");
        session.setSubjectEmail(EMAIL);
        session.setLastActiveAt(lastActiveAt);
        // Original 30-minute window, still intact at this point: expiresAt is
        // exactly lastActiveAt + 30 minutes.
        session.setExpiresAt(lastActiveAt.plusMinutes(30));
        when(activeSessionRepository.findByTokenId("tok-slide")).thenReturn(Optional.of(session));

        assertThat(sessionService(30, 240).validateAndTouch("tok-slide", EMAIL)).isTrue();

        // The same 30-minute window should be re-applied from "now", not left
        // at its original (now nearly-elapsed) cutoff -- this is what keeps an
        // actively-used session from expiring mid-activity.
        verify(activeSessionRepository).touch(
            eq("tok-slide"),
            any(OffsetDateTime.class),
            argThat(newExpiresAt ->
                newExpiresAt.isAfter(OffsetDateTime.now().plusMinutes(29))
                    && newExpiresAt.isBefore(OffsetDateTime.now().plusMinutes(31))
            )
        );
    }

    @Test
    void sessionWithinTheTouchThrottleIsNotReTouched() {
        ActiveSession session = new ActiveSession();
        session.setTokenId("tok-throttled");
        session.setSubjectEmail(EMAIL);
        session.setLastActiveAt(OffsetDateTime.now());
        session.setExpiresAt(OffsetDateTime.now().plusMinutes(30));
        when(activeSessionRepository.findByTokenId("tok-throttled")).thenReturn(Optional.of(session));

        assertThat(sessionService(30, 240).validateAndTouch("tok-throttled", EMAIL)).isTrue();

        verify(activeSessionRepository, never()).touch(anyString(), any(), any());
    }

    @Test
    void sessionPastItsAbsoluteExpiryIsRejectedAndRevokedEvenIfRecentlyActive() {
        ActiveSession session = new ActiveSession();
        session.setTokenId("tok-2");
        session.setSubjectEmail(EMAIL);
        // Active a moment ago (would pass any inactivity-only check) but the
        // absolute lifetime granted at login has already elapsed.
        session.setLastActiveAt(OffsetDateTime.now().minusSeconds(5));
        session.setExpiresAt(OffsetDateTime.now().minusMinutes(1));
        when(activeSessionRepository.findByTokenId("tok-2")).thenReturn(Optional.of(session));

        assertThat(sessionService(30, 240).validateAndTouch("tok-2", EMAIL)).isFalse();
        verify(activeSessionRepository).deleteByTokenId("tok-2");
    }

    @Test
    void sessionExactlyAtItsExpiryMomentIsRejected() {
        OffsetDateTime now = OffsetDateTime.now();
        ActiveSession session = new ActiveSession();
        session.setTokenId("tok-3");
        session.setSubjectEmail(EMAIL);
        session.setLastActiveAt(now.minusMinutes(1));
        session.setExpiresAt(now);
        when(activeSessionRepository.findByTokenId("tok-3")).thenReturn(Optional.of(session));

        assertThat(sessionService(30, 240).validateAndTouch("tok-3", EMAIL)).isFalse();
    }

    @Test
    void liveSessionIsRejectedWhenTheTokenSubjectIsADifferentUser() {
        // A forged token reusing a real session's jti but naming another subject.
        ActiveSession session = new ActiveSession();
        session.setTokenId("tok-forged");
        session.setSubjectEmail(EMAIL);
        session.setLastActiveAt(OffsetDateTime.now().minusMinutes(1));
        session.setExpiresAt(OffsetDateTime.now().plusMinutes(29));
        when(activeSessionRepository.findByTokenId("tok-forged")).thenReturn(Optional.of(session));

        assertThat(sessionService(30, 240).validateAndTouch("tok-forged", "admin@nforce.test")).isFalse();

        // The real user's session must survive: no touch, no revocation.
        verify(activeSessionRepository, never()).touch(anyString(), any(), any());
        verify(activeSessionRepository, never()).deleteByTokenId(anyString());
    }

    @Test
    void sessionIsRejectedWhenTheTokenHasNoSubject() {
        ActiveSession session = new ActiveSession();
        session.setTokenId("tok-nosub");
        session.setSubjectEmail(EMAIL);
        session.setLastActiveAt(OffsetDateTime.now());
        session.setExpiresAt(OffsetDateTime.now().plusMinutes(30));
        when(activeSessionRepository.findByTokenId("tok-nosub")).thenReturn(Optional.of(session));

        assertThat(sessionService(30, 240).validateAndTouch("tok-nosub", null)).isFalse();
    }

    @Test
    void invalidateDeletesTheSessionRow() {
        sessionService(30, 240).invalidate("tok-4");

        verify(activeSessionRepository).deleteByTokenId("tok-4");
    }

    @Test
    void creatingAStandardSessionExpiresThirtyMinutesFromNow() {
        sessionService(30, 240).createSession("tok-5", "user@nforce.test", PrincipalType.USER, 30);

        verify(activeSessionRepository).save(argThat(session ->
            "tok-5".equals(session.getTokenId())
                && "user@nforce.test".equals(session.getSubjectEmail())
                && session.getExpiresAt() != null
                && session.getExpiresAt().isAfter(OffsetDateTime.now().plusMinutes(29))
                && session.getExpiresAt().isBefore(OffsetDateTime.now().plusMinutes(31))
        ));
    }

    @Test
    void creatingARememberMeSessionExpiresFourHoursFromNow() {
        sessionService(30, 240).createSession("tok-6", "user@nforce.test", PrincipalType.USER, 240);

        verify(activeSessionRepository).save(argThat(session ->
            "tok-6".equals(session.getTokenId())
                && session.getExpiresAt() != null
                && session.getExpiresAt().isAfter(OffsetDateTime.now().plusMinutes(239))
                && session.getExpiresAt().isBefore(OffsetDateTime.now().plusMinutes(241))
        ));
    }

    @Test
    void invalidateAllForUserRevokesEverySessionThatUserHolds() {
        sessionService(30, 240).invalidateAllForUser("employee@nforce.test", PrincipalType.USER);

        verify(activeSessionRepository)
            .deleteByPrincipalTypeAndSubjectEmail(PrincipalType.USER, "employee@nforce.test");
        verify(activeSessionRepository, never()).deleteByTokenId(anyString());
    }

    @Test
    void invalidatingAUserNeverTouchesASuperAdminSessionWithTheSameEmail() {
        sessionService(30, 240).invalidateAllForUser("shared@nforce.test", PrincipalType.USER);

        verify(activeSessionRepository)
            .deleteByPrincipalTypeAndSubjectEmail(PrincipalType.USER, "shared@nforce.test");
        verify(activeSessionRepository, never())
            .deleteByPrincipalTypeAndSubjectEmail(eq(PrincipalType.SUPER_ADMIN), anyString());
    }
}
