package com.nforce.retailops.controller;

import com.nforce.retailops.dto.MonthlyCashSummaryResponse;
import com.nforce.retailops.service.MonthlyCashSummaryService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

// Super Admin: month-end cash summary across stores plus a Combined total.
// storeIds omitted means every active store (and any inactive one that traded
// that month).
@RestController
@RequestMapping("/api/super-admin/cash/monthly-summary")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminMonthlyCashSummaryController {

    private final MonthlyCashSummaryService service;

    public SuperAdminMonthlyCashSummaryController(MonthlyCashSummaryService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<MonthlyCashSummaryResponse> get(
        @RequestParam(required = false) String month,
        @RequestParam(required = false) List<Long> storeIds
    ) {
        return ResponseEntity.ok(service.getForSuperAdmin(month, storeIds));
    }
}
