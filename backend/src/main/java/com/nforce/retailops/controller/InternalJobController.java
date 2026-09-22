package com.nforce.retailops.controller;

import com.nforce.retailops.service.LoginRateLimitService;
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

    @Value("${INTERNAL_JOB_SECRET:}")
    private String internalJobSecret;

    public InternalJobController(
            SuperAdminAlertService superAdminAlertService,
            RaisedIssueService raisedIssueService,
            TaskService taskService,
            TaskMakeupLinkService taskMakeupLinkService,
            LoginRateLimitService loginRateLimitService) {
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
        taskMakeupLinkService.expireStalePendingLinks();
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

    private ResponseEntity<String> checkSecret(String providedSecret) {
        if (providedSecret == null) {
            return ResponseEntity.status(401).body("Missing X-Internal-Job-Secret header");
        }
        if (internalJobSecret.isBlank()) {
            return ResponseEntity.status(503).body("INTERNAL_JOB_SECRET not configured");
        }
        if (!internalJobSecret.equals(providedSecret)) {
            return ResponseEntity.status(403).body("Invalid secret");
        }
        return null;
    }
}
