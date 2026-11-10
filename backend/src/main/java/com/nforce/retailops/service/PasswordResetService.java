package com.nforce.retailops.service;

import com.nforce.retailops.entity.PasswordResetToken;
import com.nforce.retailops.exception.InvalidPasswordResetTokenException;
import com.nforce.retailops.repository.PasswordResetTokenRepository;
import com.nforce.retailops.repository.UserRepository;
import com.nforce.retailops.security.ResetTokenHashing;
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
        // An email with leading/trailing whitespace must not be treated as the
        // trimmed email -- reject silently, same as the "user not found" case
        // below, so the response never reveals which reason caused the no-op.
        if (!email.equals(email.strip())) return;

        String normalised = email.strip().toLowerCase();

        // Silent no-op if user not found — identical response prevents email enumeration.
        var userOpt = userRepository.findByEmailWithRoles(normalised);
        if (userOpt.isEmpty()) return;

        // Lock the account row so concurrent requests for the same email run
        // the count-then-insert one at a time; the lock is held until commit.
        if (userRepository.findByEmailForUpdate(normalised).isEmpty()) return;

        // DB-backed rate limit: max 3 tokens per email per hour.
        OffsetDateTime since = OffsetDateTime.now().minusHours(1);
        if (tokenRepository.countByEmailSince(normalised, since) >= MAX_REQUESTS_PER_HOUR) return;

        UUID token = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        // Only the newest link may work: retire any earlier still-valid ones.
        tokenRepository.invalidateOutstandingForEmail(normalised, now);
        tokenRepository.save(new PasswordResetToken(normalised, ResetTokenHashing.hash(token), now, now.plusHours(1)));

        String fullName = userOpt.get().getFullName();
        String resetLink = appBaseUrl + "?token=" + token;

        try {
            mailService.sendPasswordResetEmail(normalised, fullName, resetLink);
        } catch (Exception ex) {
            log.warn("Password reset email delivery failed for {} — token still valid", normalised, ex);
        }
    }

    // Account-setup link (owner/employee invite, resend, email change). Returns
    // the raw token for the link; only its hash is stored.
    @Transactional
    public String createSetupToken(String email) {
        UUID token = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        tokenRepository.save(new PasswordResetToken(email, ResetTokenHashing.hash(token), now, now.plusHours(72)));
        return token.toString();
    }

    @Transactional
    public void confirmReset(String rawToken, String newPassword) {
        UUID uuid;
        try {
            uuid = UUID.fromString(rawToken);
        } catch (IllegalArgumentException e) {
            throw new InvalidPasswordResetTokenException("Invalid or expired reset link");
        }

        // Parsing first keeps malformed input on the same error path, and the
        // canonical form means a link that differs only in letter case still
        // resolves to the same hash.
        String tokenHash = ResetTokenHashing.hash(uuid);
        PasswordResetToken resetToken = tokenRepository.findByTokenHash(tokenHash)
            .orElseThrow(() -> new InvalidPasswordResetTokenException("Invalid or expired reset link"));

        if (resetToken.isUsed() || resetToken.isExpired()) {
            throw new InvalidPasswordResetTokenException("Invalid or expired reset link");
        }

        // Atomically claim the token; losing a concurrent race affects 0 rows.
        OffsetDateTime now = OffsetDateTime.now();
        if (tokenRepository.markUsedIfUnused(tokenHash, now, now) != 1) {
            throw new InvalidPasswordResetTokenException("Invalid or expired reset link");
        }

        var user = userRepository.findByEmailWithRoles(resetToken.getEmail())
            .orElseThrow(() -> new InvalidPasswordResetTokenException("Invalid or expired reset link"));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setMustResetPassword(false);

        userRepository.save(user);
    }
}
