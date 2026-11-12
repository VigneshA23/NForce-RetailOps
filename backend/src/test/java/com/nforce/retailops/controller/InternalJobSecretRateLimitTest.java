package com.nforce.retailops.controller;

import com.nforce.retailops.repository.InternalJobAttemptRepository;
import com.nforce.retailops.service.InternalJobRateLimitService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** RTS-484: per-IP throttling and constant-time check on /internal/jobs/**. */
@SpringBootTest(properties = "INTERNAL_JOB_SECRET=test-job-secret")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InternalJobSecretRateLimitTest {

    // Not @Transactional: the service commits its own transactions.
    private static final String PATH = "/internal/jobs/purge-login-attempts";
    private static final String SECRET = "test-job-secret";

    @Autowired private MockMvc mockMvc;
    @Autowired private InternalJobAttemptRepository repository;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
    }

    private ResultActions call(String ip, String secret) throws Exception {
        var req = post(PATH).with(r -> { r.setRemoteAddr(ip); return r; });
        if (secret != null) req = req.header("X-Internal-Job-Secret", secret);
        return mockMvc.perform(req);
    }

    private void failTimes(String ip, int n) throws Exception {
        for (int i = 0; i < n; i++) call(ip, "wrong").andExpect(status().isForbidden());
    }

    @Test
    void wrongSecretReturns403AndMissingReturns401() throws Exception {
        call("10.0.0.1", "wrong").andExpect(status().isForbidden());
        call("10.0.0.1", null).andExpect(status().isUnauthorized());
        assertEquals(2, repository.count());
    }

    @Test
    void sixthWrongAttemptFromSameIpGets429() throws Exception {
        failTimes("10.0.0.2", InternalJobRateLimitService.MAX_ATTEMPTS);
        call("10.0.0.2", "wrong").andExpect(status().isTooManyRequests());
    }

    @Test
    void missingHeaderCountsTowardLimit() throws Exception {
        for (int i = 0; i < InternalJobRateLimitService.MAX_ATTEMPTS; i++) {
            call("10.0.0.3", null).andExpect(status().isUnauthorized());
        }
        call("10.0.0.3", "wrong").andExpect(status().isTooManyRequests());
    }

    @Test
    void correctSecretStillSucceedsFromThrottledIp() throws Exception {
        failTimes("10.0.0.4", InternalJobRateLimitService.MAX_ATTEMPTS);
        call("10.0.0.4", "wrong").andExpect(status().isTooManyRequests());
        call("10.0.0.4", SECRET).andExpect(status().isOk());
    }

    @Test
    void otherIpIsUnaffected() throws Exception {
        failTimes("10.0.0.5", InternalJobRateLimitService.MAX_ATTEMPTS);
        call("10.0.0.5", "wrong").andExpect(status().isTooManyRequests());
        call("10.0.0.6", "wrong").andExpect(status().isForbidden());
        call("10.0.0.6", SECRET).andExpect(status().isOk());
    }

    @Test
    void forgedForwardedForHeaderDoesNotChangeCountedIp() throws Exception {
        failTimes("10.0.0.7", InternalJobRateLimitService.MAX_ATTEMPTS);
        mockMvc.perform(post(PATH)
                .with(r -> { r.setRemoteAddr("10.0.0.7"); return r; })
                .header("X-Forwarded-For", "203.0.113.9")
                .header("X-Internal-Job-Secret", "wrong"))
            .andExpect(status().isTooManyRequests());
    }

    @Test
    void successfulPurgeCallDoesNotRecordAFailure() throws Exception {
        call("10.0.0.8", SECRET).andExpect(status().isOk());
        assertEquals(0, repository.count());
    }
}
