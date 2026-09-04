package com.nforce.retailops.service;

import com.nforce.retailops.entity.PasswordResetToken;
import com.nforce.retailops.exception.InvalidPasswordResetTokenException;
import com.nforce.retailops.repository.PasswordResetTokenRepository;
import com.nforce.retailops.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final int MAX_REQUESTS_PER_HOUR = 3;

    private final PasswordResetTokenRepository tokenRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;
    private final String appBaseUrl;

    public PasswordResetService(
        PasswordResetTokenRepository tokenRepository,
        UserRepository userRepository,
        PasswordEncoder passwordEncoder,
        MailService mailService,
        @Value("${app.base-url}") String appBaseUrl
    ) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
        this.appBaseUrl = appBaseUrl;
    }

    @Transactional
    public void requestReset(String email) {
        String normalised = email.strip().toLowerCase();

        // Silent no-op if user not found — identical response prevents email enumeration.
        var userOpt = userRepository.findByEmailWithRoles(normalised);
        if (userOpt.isEmpty()) return;

        // DB-backed rate limit: max 3 tokens per email per hour.
        OffsetDateTime since = OffsetDateTime.now().minusHours(1);
        if (tokenRepository.countByEmailSince(normalised, since) >= MAX_REQUESTS_PER_HOUR) return;

        UUID token = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        tokenRepository.save(new PasswordResetToken(normalised, token, now, now.plusHours(1)));

        String fullName = userOpt.get().getFullName();
        String resetLink = appBaseUrl + "?token=" + token;

        try {
            mailService.sendPasswordResetEmail(normalised, fullName, resetLink);
        } catch (Exception ex) {
            log.warn("Password reset email delivery failed for {} — token still valid", normalised, ex);
        }
    }

    @Transactional
    public void confirmReset(String rawToken, String newPassword) {
        UUID uuid;
        try {
            uuid = UUID.fromString(rawToken);
        } catch (IllegalArgumentException e) {
            throw new InvalidPasswordResetTokenException("Invalid or expired reset link");
        }

        PasswordResetToken resetToken = tokenRepository.findByToken(uuid)
            .orElseThrow(() -> new InvalidPasswordResetTokenException("Invalid or expired reset link"));

        if (resetToken.isUsed() || resetToken.isExpired()) {
            throw new InvalidPasswordResetTokenException("Invalid or expired reset link");
        }

        resetToken.setUsedAt(OffsetDateTime.now());

        var user = userRepository.findByEmailWithRoles(resetToken.getEmail())
            .orElseThrow(() -> new InvalidPasswordResetTokenException("Invalid or expired reset link"));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setMustResetPassword(false);

        userRepository.save(user);
        tokenRepository.save(resetToken);
    }
}
