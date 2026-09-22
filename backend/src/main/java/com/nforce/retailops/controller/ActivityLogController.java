package com.nforce.retailops.controller;

import com.nforce.retailops.dto.ActivityLogEntryResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.ActivityLogService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/activity")
@PreAuthorize("hasAnyRole('OWNER_ADMIN', 'SUPER_ADMIN')")
public class ActivityLogController {

    private static final int MAX_LIMIT = 100;

    private final ActivityLogService activityLogService;

    public ActivityLogController(ActivityLogService activityLogService) {
        this.activityLogService = activityLogService;
    }

    // Shared by both roles: Owner Admin gets activity scoped to their own
    // store(s), Super Admin gets every store platform-wide. startDate/endDate
    // are both optional and only meaningful together -- omitted, the feed is
    // unfiltered by date (the Home dashboard widget's usage); supplied, only
    // that inclusive local-calendar-day window is returned (the Recent
    // Activity "view all" page's date filter).
    @GetMapping
    public ResponseEntity<List<ActivityLogEntryResponse>> recent(
        Authentication authentication,
        @RequestParam(defaultValue = "20") int limit,
        @RequestParam(required = false) LocalDate startDate,
        @RequestParam(required = false) LocalDate endDate
    ) {
        int cappedLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
        if (authentication.getPrincipal() instanceof AppUserDetails appUserDetails) {
            return ResponseEntity.ok(activityLogService.getRecentForOwner(appUserDetails.getUser().getId(), cappedLimit, startDate, endDate));
        }
        return ResponseEntity.ok(activityLogService.getRecentForPlatform(cappedLimit, startDate, endDate));
    }
}
