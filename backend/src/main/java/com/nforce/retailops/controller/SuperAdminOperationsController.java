package com.nforce.retailops.controller;

import com.nforce.retailops.dto.CreateOrderListEntryRequest;
import com.nforce.retailops.dto.OrderListEntryResponse;
import com.nforce.retailops.dto.OutstandingOrdersOverviewResponse;
import com.nforce.retailops.dto.PlatformStatsResponse;
import com.nforce.retailops.dto.StoreOperationsSummaryResponse;
import com.nforce.retailops.dto.StoreSupplierPurchaseMetricResponse;
import com.nforce.retailops.dto.TrendDataPoint;
import com.nforce.retailops.dto.UpdateOrderStatusRequest;
import com.nforce.retailops.service.SuperAdminOperationsService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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

    // Read-only platform-wide rollup. Per-store drill-down and status changes are
    // the two endpoints below. No principal is resolved here -- a Super Admin has
    // no users row and therefore no store scope; the class-level @PreAuthorize is
    // the whole guard.
    @GetMapping("/outstanding-orders")
    public OutstandingOrdersOverviewResponse getOutstandingOrders() {
        return service.getOutstandingOrdersOverview();
    }

    // Drill-down from the overview above into one store's individual order-list
    // entries, and the action that moves one through its lifecycle. Unlike every
    // other endpoint here, Super Admin can act on ANY store (it has none of its
    // own) -- the transition rule itself (one step at a time, Needs Ordering ->
    // Ordered -> Received) is unchanged from Owner/Admin's, enforced in
    // OrderListService so both roles share exactly one definition of it.
    @GetMapping("/stores/{storeId}/order-list")
    public List<OrderListEntryResponse> getOrderListForStore(@PathVariable Long storeId) {
        return service.getOrderListForStore(storeId);
    }

    @PatchMapping("/stores/{storeId}/order-list/{entryId}/status")
    public OrderListEntryResponse updateOrderStatus(
        @PathVariable Long storeId,
        @PathVariable Long entryId,
        @Valid @RequestBody UpdateOrderStatusRequest request
    ) {
        return service.updateOrderStatus(storeId, entryId, request.status());
    }

    // Super Admin's "Add to order" for a specific store, counterpart to
    // OrderListController.create. Unlike that one, the store comes from the
    // path rather than the caller's own StoreOwner link, since a Super Admin
    // has none.
    @PostMapping("/stores/{storeId}/order-list")
    public ResponseEntity<OrderListEntryResponse> createOrderListEntry(
        @PathVariable Long storeId,
        @Valid @RequestBody CreateOrderListEntryRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(service.createOrderListEntry(storeId, request));
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
