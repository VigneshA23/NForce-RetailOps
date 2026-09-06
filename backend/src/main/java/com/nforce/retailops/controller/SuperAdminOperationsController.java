package com.nforce.retailops.controller;

import com.nforce.retailops.dto.PlatformStatsResponse;
import com.nforce.retailops.dto.StoreOperationsSummaryResponse;
import com.nforce.retailops.service.SuperAdminOperationsService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/super-admin")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminOperationsController {

    private final SuperAdminOperationsService service;

    public SuperAdminOperationsController(SuperAdminOperationsService service) {
        this.service = service;
    }

    @GetMapping("/operations-overview")
    public List<StoreOperationsSummaryResponse> getOperationsOverview(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return service.getOperationsOverview(date != null ? date : LocalDate.now());
    }

    @GetMapping("/platform-stats")
    public PlatformStatsResponse getPlatformStats(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return service.getPlatformStats(date != null ? date : LocalDate.now());
    }
}
