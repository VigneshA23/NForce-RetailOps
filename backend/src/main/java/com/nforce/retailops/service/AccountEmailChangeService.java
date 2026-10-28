package com.nforce.retailops.service;

import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmailDeliveryException;
import com.nforce.retailops.repository.PasswordResetTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * What has to happen when an admin changes the login email of an employee or
 * owner. The email is the login and the key for sessions and setup/reset
 * links, so a change must:
 * <ul>
 *   <li>sign the user out everywhere (their tokens carry the old email);</li>
 *   <li>void every setup/reset link issued to the old address;</li>
 *   <li>if the account is not set up yet, send a fresh setup link to the new
 *       address -- typically the admin is correcting a mistyped email, and the
 *       original link went nowhere;</li>
 *   <li>otherwise tell both addresses that the login email changed.</li>
 * </ul>
 * Called from inside the caller's transaction. The database work joins it, but
 * the emails are only sent once it commits, and a failed send is logged rather
 * than undoing the change.
 */
@Service
public class AccountEmailChangeService {

    private static final Logger log = LoggerFactory.getLogger(AccountEmailChangeService.class);

    private final SessionService sessionService;
    private final PasswordResetService passwordResetService;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final MailService mailService;
    private final String appBaseUrl;

    public AccountEmailChangeService(
        SessionService sessionService,
        PasswordResetService passwordResetService,
        PasswordResetTokenRepository passwordResetTokenRepository,
        MailService mailService,
        @Value("${app.base-url}") String appBaseUrl
    ) {
        this.sessionService = sessionService;
        this.passwordResetService = passwordResetService;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.mailService = mailService;
        this.appBaseUrl = appBaseUrl;
    }

    /** True when the new email is a different login, not just a change of letter case. */
    public static boolean isChange(String previousEmail, String newEmail) {
        return !previousEmail.equalsIgnoreCase(newEmail);
    }

    /** Call after the user's new email has been set and saved. */
    public void emailChanged(User user, String previousEmail) {
        String newEmail = user.getEmail();
        String fullName = user.getFullName();

        sessionService.invalidateAllForUser(previousEmail);
        passwordResetTokenRepository.deleteByEmailIgnoreCase(previousEmail);

        if (user.isMustResetPassword()) {
            String token = passwordResetService.createSetupToken(newEmail);
            afterCommit(() -> deliver(newEmail, "setup", () ->
                mailService.sendAccountSetupEmail(newEmail, fullName, appBaseUrl + "?token=" + token)));
        } else {
            afterCommit(() -> {
                deliver(previousEmail, "email-changed", () ->
                    mailService.sendLoginEmailChangedEmail(previousEmail, fullName, newEmail));
                deliver(newEmail, "email-changed", () ->
                    mailService.sendLoginEmailChangedEmail(newEmail, fullName, newEmail));
            });
        }
    }

    private void deliver(String toEmail, String kind, Runnable send) {
        try {
            send.run();
        } catch (EmailDeliveryException ex) {
            log.warn("Could not send {} email to {} after a login email change", kind, toEmail, ex);
        }
    }

    // Outside a transaction (unit tests) there is nothing to wait for.
    private static void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
