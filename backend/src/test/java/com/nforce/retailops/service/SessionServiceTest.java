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

    private SessionService sessionService(long timeoutMinutes) {
        return new SessionService(activeSessionRepository, timeoutMinutes);
    }

    @Test
    void reportsConfiguredTimeoutBackVerbatim() {
        assertThat(sessionService(10).getInactivityTimeoutMinutes()).isEqualTo(10);
        assertThat(sessionService(45).getInactivityTimeoutMinutes()).isEqualTo(45);
    }

    @Test
    void unknownTokenIdIsNotValid() {
        when(activeSessionRepository.findByTokenId("missing")).thenReturn(Optional.empty());

        assertThat(sessionService(10).validateAndTouch("missing")).isFalse();
    }

    @Test
    void recentlyActiveSessionIsValid() {
        ActiveSession session = new ActiveSession();
        session.setTokenId("tok-1");
        session.setLastActiveAt(OffsetDateTime.now());
        when(activeSessionRepository.findByTokenId("tok-1")).thenReturn(Optional.of(session));

        assertThat(sessionService(10).validateAndTouch("tok-1")).isTrue();
        verify(activeSessionRepository, never()).deleteByTokenId(anyString());
    }

    @Test
    void sessionIdleLongerThanTimeoutIsExpiredAndRevoked() {
        ActiveSession session = new ActiveSession();
        session.setTokenId("tok-2");
        session.setLastActiveAt(OffsetDateTime.now().minusMinutes(11));
        when(activeSessionRepository.findByTokenId("tok-2")).thenReturn(Optional.of(session));

        assertThat(sessionService(10).validateAndTouch("tok-2")).isFalse();
        verify(activeSessionRepository).deleteByTokenId("tok-2");
    }

    @Test
    void sessionIdleJustUnderTimeoutRemainsValid() {
        ActiveSession session = new ActiveSession();
        session.setTokenId("tok-3");
        session.setLastActiveAt(OffsetDateTime.now().minusMinutes(9));
        when(activeSessionRepository.findByTokenId("tok-3")).thenReturn(Optional.of(session));

        assertThat(sessionService(10).validateAndTouch("tok-3")).isTrue();
    }

    @Test
    void invalidateDeletesTheSessionRow() {
        sessionService(10).invalidate("tok-4");

        verify(activeSessionRepository).deleteByTokenId("tok-4");
    }

    @Test
    void creatingASessionPersistsItWithTheGivenTokenIdAndSubject() {
        sessionService(10).createSession("tok-5", "user@nforce.test");

        verify(activeSessionRepository).save(argThat(session ->
            "tok-5".equals(session.getTokenId()) && "user@nforce.test".equals(session.getSubjectEmail())
        ));
    }
}
