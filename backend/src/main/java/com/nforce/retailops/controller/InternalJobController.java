package com.nforce.retailops.controller;

import com.nforce.retailops.service.InternalJobRateLimitService;
import com.nforce.retailops.service.LoginRateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import com.nforce.retailops.service.RaisedIssueService;
import com.nforce.retailops.service.SuperAdminAlertService;
import com.nforce.retailops.service.TaskMakeupLinkService;
import com.nforce.retailops.service.TaskService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Internal job endpoints called by EventBridge Scheduler (via Lambda Function URL)
 * in place of @Scheduled in-process timers when deployed on Lambda.
 *
 * Auth: each request must carry X-Internal-Job-Secret matching INTERNAL_JOB_SECRET.
 * Missing header → 401. Wrong value → 403. Secret not configured → 503.
 * Comparison is constant-time. Wrong/missing attempts are counted per caller IP
 * (5 per 15 min, then 429); the correct secret always succeeds (RTS-484).
 *
 * These endpoints are added to SecurityConfig's permitAll() list so EventBridge
 * can reach them without a JWT. The shared-secret header is the sole auth mechanism.
 * On Railway/local dev the endpoints exist but nothing calls them — no EventBridge
 * exists pointing at Railway.
 */
@RestController
@RequestMapping("/internal/jobs")
public class InternalJobController {

    private final SuperAdminAlertService superAdminAlertService;
    private final RaisedIssueService raisedIssueService;
    private final TaskService taskService;
    private final TaskMakeupLinkService taskMakeupLinkService;
    private final LoginRateLimitService loginRateLimitService;
    private final InternalJobRateLimitService rateLimitService;
    private final HttpServletRequest request; // injected as a per-request proxy

    @Value("${INTERNAL_JOB_SECRET:}")
    private String internalJobSecret;

    public InternalJobController(
            SuperAdminAlertService superAdminAlertService,
            RaisedIssueService raisedIssueService,
            TaskService taskService,
            TaskMakeupLinkService taskMakeupLinkService,
            LoginRateLimitService loginRateLimitService,
            InternalJobRateLimitService rateLimitService,
            HttpServletRequest request) {
        this.rateLimitService = rateLimitService;
        this.request = request;
        this.superAdminAlertService = superAdminAlertService;
        this.raisedIssueService = raisedIssueService;
        this.taskService = taskService;
        this.taskMakeupLinkService = taskMakeupLinkService;
        this.loginRateLimitService = loginRateLimitService;
    }

    /** 8pm daily: notify Super Admins of stores with zero checklist activity today. */
    @PostMapping("/zero-activity-check")
    public ResponseEntity<String> zeroActivityCheck(
            @RequestHeader(value = "X-Internal-Job-Secret", required = false) String secret) {
        ResponseEntity<String> authError = checkSecret(secret);
        if (authError != null) return authError;
        superAdminAlertService.runZeroActivityCheck();
        return ResponseEntity.ok("zero-activity-check completed");
    }

    /** 9am daily: notify Super Admins of stores with OPEN issues older than 48 hours. */
    @PostMapping("/overdue-issues-check")
    public ResponseEntity<String> overdueIssuesCheck(
            @RequestHeader(value = "X-Internal-Job-Secret", required = false) String secret) {
        ResponseEntity<String> authError = checkSecret(secret);
        if (authError != null) return authError;
        superAdminAlertService.runOverdueIssuesCheck();
        return ResponseEntity.ok("overdue-issues-check completed");
    }

    /** Hourly: notify Super Admins of stores whose Owner/Admin has been vacant over 24 hours. */
    @PostMapping("/owner-vacancy-check")
    public ResponseEntity<String> ownerVacancyCheck(
            @RequestHeader(value = "X-Internal-Job-Secret", required = false) String secret) {
        ResponseEntity<String> authError = checkSecret(secret);
        if (authError != null) return authError;
        superAdminAlertService.runOwnerVacancyCheck();
        return ResponseEntity.ok("owner-vacancy-check completed");
    }

    /**
     * 3am daily: purge resolved issues older than 7 days, deactivate tasks past end
     * date, and expire stale PENDING "Missed Tasks" links (linked_date < today).
     */
    @PostMapping("/nightly-maintenance")
    public ResponseEntity<String> nightlyMaintenance(
            @RequestHeader(value = "X-Internal-Job-Secret", required = false) String secret) {
        ResponseEntity<String> authError = checkSecret(secret);
        if (authError != null) return authError;
        raisedIssueService.purgeOldResolvedIssues();
        taskService.deactivateTasksPastEndDate();
        taskMakeupLinkService.expireStalePendingMoves();
        return ResponseEntity.ok("nightly-maintenance completed");
    }

    /** Hourly: purge login_attempts rows older than 2× the rate-limit window. */
    @PostMapping("/purge-login-attempts")
    public ResponseEntity<String> purgeLoginAttempts(
            @RequestHeader(value = "X-Internal-Job-Secret", required = false) String secret) {
        ResponseEntity<String> authError = checkSecret(secret);
        if (authError != null) return authError;
        loginRateLimitService.purgeExpiredAttempts();
        return ResponseEntity.ok("purge-login-attempts completed");
    }

    /**
     * Returns null when the caller may proceed. The correct secret always succeeds,
     * even from a throttled IP; only wrong/missing secrets are counted (per IP) and,
     * once the IP is over its limit, answered with 429.
     *
     * The IP is request.getRemoteAddr() on purpose — never X-Forwarded-For, which a
     * client can forge. On Lambda the serverless container fills it from the Function
     * URL's requestContext.http.sourceIp (trust to be confirmed in RTS-507).
     */
    private ResponseEntity<String> checkSecret(String providedSecret) {
        if (!internalJobSecret.isBlank() && providedSecret != null
                && MessageDigest.isEqual(
                        internalJobSecret.getBytes(StandardCharsets.UTF_8),
                        providedSecret.getBytes(StandardCharsets.UTF_8))) {
            return null;
        }
        if (providedSecret != null && internalJobSecret.isBlank()) {
            return ResponseEntity.status(503).body("INTERNAL_JOB_SECRET not configured");
        }

        String ip = request.getRemoteAddr();
        if (ip == null || ip.isBlank()) ip = "unknown";
        if (rateLimitService.isBlocked(ip)) {
            return ResponseEntity.status(429).body("Too many failed attempts. Try again later.");
        }
        rateLimitService.recordFailure(ip);
        if (providedSecret == null) {
            return ResponseEntity.status(401).body("Missing X-Internal-Job-Secret header");
        }
        return ResponseEntity.status(403).body("Invalid secret");
    }
}
