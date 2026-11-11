package com.nforce.retailops.service;

import com.nforce.retailops.entity.InternalJobAttempt;
import com.nforce.retailops.repository.InternalJobAttemptRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * Per-IP failed-attempt throttling for /internal/jobs/** (RTS-484). Mirrors
 * {@link LoginRateLimitService}: 5 failures in 15 minutes, stored in a table
 * and purged by the existing hourly purge job. Only ever consulted for requests
 * that did NOT present the correct secret, so a throttled IP can never block
 * the real scheduler.
 */
@Service
public class InternalJobRateLimitService {

    public static final int MAX_ATTEMPTS   = LoginRateLimitService.MAX_ATTEMPTS;
    public static final int WINDOW_MINUTES = LoginRateLimitService.WINDOW_MINUTES;

    private final InternalJobAttemptRepository repository;

    public InternalJobRateLimitService(InternalJobAttemptRepository repository) {
        this.repository = repository;
    }

    /** True if this IP has already used up its failure budget for the window. */
    public boolean isBlocked(String ip) {
        OffsetDateTime since = OffsetDateTime.now().minusMinutes(WINDOW_MINUTES);
        return repository.countByIpSince(ip, since) >= MAX_ATTEMPTS;
    }

    @Transactional
    public void recordFailure(String ip) {
        repository.save(new InternalJobAttempt(ip));
    }

    @Transactional
    public void purgeExpiredAttempts() {
        repository.deleteOlderThan(OffsetDateTime.now().minusMinutes(WINDOW_MINUTES * 2L));
    }
}
