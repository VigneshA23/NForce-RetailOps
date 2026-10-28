package com.nforce.retailops.service;

import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmailDeliveryException;
import com.nforce.retailops.repository.PasswordResetTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountEmailChangeServiceTest {

    private static final String OLD_EMAIL = "jhon@nforce.test";
    private static final String NEW_EMAIL = "john@nforce.test";

    @Mock
    private SessionService sessionService;
    @Mock
    private PasswordResetService passwordResetService;
    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock
    private MailService mailService;

    private AccountEmailChangeService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new AccountEmailChangeService(
            sessionService, passwordResetService, passwordResetTokenRepository, mailService, "http://localhost:5173");
        user = new User();
        user.setFullName("John Smith");
        user.setEmail(NEW_EMAIL);
    }

    @Test
    void aChangeOfLetterCaseIsNotAChange() {
        assertThat(AccountEmailChangeService.isChange("John@NForce.test", "john@nforce.test")).isFalse();
        assertThat(AccountEmailChangeService.isChange(OLD_EMAIL, NEW_EMAIL)).isTrue();
    }

    @Test
    void anAccountNotYetSetUpGetsAFreshSetupLinkAtTheNewAddress() {
        user.setMustResetPassword(true);
        when(passwordResetService.createSetupToken(NEW_EMAIL)).thenReturn("new-token");

        service.emailChanged(user, OLD_EMAIL);

        verify(sessionService).invalidateAllForUser(OLD_EMAIL);
        verify(passwordResetTokenRepository).deleteByEmailIgnoreCase(OLD_EMAIL);
        verify(mailService).sendAccountSetupEmail(NEW_EMAIL, "John Smith", "http://localhost:5173?token=new-token");
        verify(mailService, never()).sendLoginEmailChangedEmail(anyString(), anyString(), anyString());
    }

    @Test
    void aSetUpAccountIsToldAtBothAddressesAndGetsNoSetupLink() {
        user.setMustResetPassword(false);

        service.emailChanged(user, OLD_EMAIL);

        verify(sessionService).invalidateAllForUser(OLD_EMAIL);
        verify(passwordResetTokenRepository).deleteByEmailIgnoreCase(OLD_EMAIL);
        verify(mailService).sendLoginEmailChangedEmail(OLD_EMAIL, "John Smith", NEW_EMAIL);
        verify(mailService).sendLoginEmailChangedEmail(NEW_EMAIL, "John Smith", NEW_EMAIL);
        verify(passwordResetService, never()).createSetupToken(anyString());
        verify(mailService, never()).sendAccountSetupEmail(anyString(), anyString(), anyString());
    }

    @Test
    void aFailedSendDoesNotUndoTheChangeOrSkipTheOtherAddress() {
        user.setMustResetPassword(false);
        doThrow(new EmailDeliveryException("down"))
            .when(mailService).sendLoginEmailChangedEmail(eq(OLD_EMAIL), anyString(), anyString());

        service.emailChanged(user, OLD_EMAIL);

        verify(mailService).sendLoginEmailChangedEmail(NEW_EMAIL, "John Smith", NEW_EMAIL);
    }
}
