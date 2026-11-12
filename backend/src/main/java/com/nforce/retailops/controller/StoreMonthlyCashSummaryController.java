package com.nforce.retailops.controller;

import com.nforce.retailops.dto.MonthlyCashSummaryResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.MonthlyCashSummaryService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// Owner/Admin: month-end cash summary for their own store. month is YYYY-MM
// and defaults to the current month.
@RestController
@RequestMapping("/api/stores/cash/monthly-summary")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class StoreMonthlyCashSummaryController {

    private final MonthlyCashSummaryService service;

    public StoreMonthlyCashSummaryController(MonthlyCashSummaryService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<MonthlyCashSummaryResponse> get(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam(required = false) String month
    ) {
        return ResponseEntity.ok(service.getForOwner(principal.getUser().getId(), month));
    }
}
