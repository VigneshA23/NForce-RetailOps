package com.nforce.retailops.service;

import com.nforce.retailops.entity.LoginAttempt;
import com.nforce.retailops.exception.LoginRateLimitException;
import com.nforce.retailops.repository.LoginAttemptRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
public class LoginRateLimitService {

    public static final int MAX_ATTEMPTS    = 5;
    public static final int WINDOW_MINUTES  = 15;

    private final LoginAttemptRepository repository;

    @Value("${login.rate-limit.enabled:true}")
    private boolean enabled;

    public LoginRateLimitService(LoginAttemptRepository repository) {
        this.repository = repository;
    }

    // Called before the password check. Throws 429 if the window is exhausted.
    // Not @Transactional: each call from the (non-transactional) controller
    // runs in its own short-lived read transaction via Spring Data defaults.
    public void checkAndBlock(String normalisedEmail) {
        if (!enabled) return;
        OffsetDateTime since = OffsetDateTime.now().minusMinutes(WINDOW_MINUTES);
        long count = repository.countByEmailSince(normalisedEmail, since);
        if (count >= MAX_ATTEMPTS) {
            throw new LoginRateLimitException(
                "Too many login attempts. Please try again in " + WINDOW_MINUTES + " minutes."
            );
        }
    }

    // Called after a failed authentication attempt.
    @Transactional
    public void recordFailure(String normalisedEmail) {
        if (!enabled) return;
        repository.save(new LoginAttempt(normalisedEmail));
    }

    // Called after a successful login — clears the slate so a user who
    // mistyped several times before succeeding isn't penalised later.
    @Transactional
    public void clearFailures(String normalisedEmail) {
        if (!enabled) return;
        repository.deleteByEmail(normalisedEmail);
    }

    // Hourly cleanup: remove attempts older than twice the window so the
    // table stays small without any manual intervention.
    @Scheduled(fixedDelayString = "PT1H")
    @Transactional
    public void purgeExpiredAttempts() {
        repository.deleteOlderThan(OffsetDateTime.now().minusMinutes(WINDOW_MINUTES * 2L));
    }
}
