package com.nforce.retailops.service;

import com.nforce.retailops.entity.ActiveSession;
import com.nforce.retailops.repository.ActiveSessionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SessionServiceTest {

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

        assertThat(sessionService(30, 240).validateAndTouch("missing")).isFalse();
    }

    @Test
    void sessionWellWithinItsExpiryIsValid() {
        ActiveSession session = new ActiveSession();
        session.setTokenId("tok-1");
        session.setLastActiveAt(OffsetDateTime.now());
        session.setExpiresAt(OffsetDateTime.now().plusMinutes(25));
        when(activeSessionRepository.findByTokenId("tok-1")).thenReturn(Optional.of(session));

        assertThat(sessionService(30, 240).validateAndTouch("tok-1")).isTrue();
        verify(activeSessionRepository, never()).deleteByTokenId(anyString());
    }

    @Test
    void sessionPastItsAbsoluteExpiryIsRejectedAndRevokedEvenIfRecentlyActive() {
        ActiveSession session = new ActiveSession();
        session.setTokenId("tok-2");
        // Active a moment ago (would pass any inactivity-only check) but the
        // absolute lifetime granted at login has already elapsed.
        session.setLastActiveAt(OffsetDateTime.now().minusSeconds(5));
        session.setExpiresAt(OffsetDateTime.now().minusMinutes(1));
        when(activeSessionRepository.findByTokenId("tok-2")).thenReturn(Optional.of(session));

        assertThat(sessionService(30, 240).validateAndTouch("tok-2")).isFalse();
        verify(activeSessionRepository).deleteByTokenId("tok-2");
    }

    @Test
    void sessionExactlyAtItsExpiryMomentIsRejected() {
        OffsetDateTime now = OffsetDateTime.now();
        ActiveSession session = new ActiveSession();
        session.setTokenId("tok-3");
        session.setLastActiveAt(now.minusMinutes(1));
        session.setExpiresAt(now);
        when(activeSessionRepository.findByTokenId("tok-3")).thenReturn(Optional.of(session));

        assertThat(sessionService(30, 240).validateAndTouch("tok-3")).isFalse();
    }

    @Test
    void invalidateDeletesTheSessionRow() {
        sessionService(30, 240).invalidate("tok-4");

        verify(activeSessionRepository).deleteByTokenId("tok-4");
    }

    @Test
    void creatingAStandardSessionExpiresThirtyMinutesFromNow() {
        sessionService(30, 240).createSession("tok-5", "user@nforce.test", 30);

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
        sessionService(30, 240).createSession("tok-6", "user@nforce.test", 240);

        verify(activeSessionRepository).save(argThat(session ->
            "tok-6".equals(session.getTokenId())
                && session.getExpiresAt() != null
                && session.getExpiresAt().isAfter(OffsetDateTime.now().plusMinutes(239))
                && session.getExpiresAt().isBefore(OffsetDateTime.now().plusMinutes(241))
        ));
    }

    @Test
    void invalidateAllForUserRevokesEverySessionThatUserHolds() {
        sessionService(30, 240).invalidateAllForUser("employee@nforce.test");

        verify(activeSessionRepository).deleteBySubjectEmail("employee@nforce.test");
        verify(activeSessionRepository, never()).deleteByTokenId(anyString());
    }
}
