package com.nforce.retailops.controller;

import com.nforce.retailops.dto.OutstandingOrdersOverviewResponse;
import com.nforce.retailops.dto.PlatformStatsResponse;
import com.nforce.retailops.dto.StoreOperationsSummaryResponse;
import com.nforce.retailops.dto.StoreSupplierPurchaseMetricResponse;
import com.nforce.retailops.dto.TrendDataPoint;
import com.nforce.retailops.service.SuperAdminOperationsService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    // Read-only. Status changes stay on the owner's Order Dashboard. No principal
    // is resolved here -- a Super Admin has no users row and therefore no store
    // scope; the class-level @PreAuthorize is the whole guard.
    @GetMapping("/outstanding-orders")
    public OutstandingOrdersOverviewResponse getOutstandingOrders() {
        return service.getOutstandingOrdersOverview();
    }

    // Supplier Purchasing Summary, platform-wide (every store, broken down by
    // store). A genuinely new access path -- Super Admin has no other route to
    // order-list data beyond the NEEDS_ORDERING-only overview above, which this
    // deliberately does not reuse or change.
    @GetMapping("/order-list/supplier-metrics")
    public List<StoreSupplierPurchaseMetricResponse> getSupplierPurchaseMetrics(
        @RequestParam(required = false) LocalDate fromDate,
        @RequestParam(required = false) LocalDate toDate
    ) {
        return service.getSupplierPurchaseMetrics(fromDate, toDate);
    }

    @GetMapping("/platform-trend")
    public List<TrendDataPoint> getPlatformTrend(@RequestParam(defaultValue = "30") int days) {
        return service.getPlatformTrend(days);
    }

    @GetMapping("/stores/{storeId}/trend")
    public List<TrendDataPoint> getStoreTrend(
        @PathVariable long storeId,
        @RequestParam(defaultValue = "30") int days
    ) {
        return service.getStoreTrend(storeId, days);
    }
}
