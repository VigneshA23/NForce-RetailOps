package com.nforce.retailops.controller;

import com.nforce.retailops.dto.StockCheckCorrectionRequest;
import com.nforce.retailops.dto.StockCheckResponse;
import com.nforce.retailops.dto.SuperAdminStockCheckHistoryPageResponse;
import com.nforce.retailops.security.SuperAdminUserDetails;
import com.nforce.retailops.service.StockCheckService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

// Super Admin's cross-store stock-check history and correction (RTS-305,
// RTS-306) -- the same StockCheckService methods/audit trail Owner/Admin's
// StoreInventoryController uses, just store-explicit rather than resolved
// from the caller's own store link, per RTS-306's own dev notes ("one
// validation and audit code path").
@RestController
@RequestMapping("/api/super-admin")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminStockCheckController {

    private final StockCheckService stockCheckService;

    public SuperAdminStockCheckController(StockCheckService stockCheckService) {
        this.stockCheckService = stockCheckService;
    }

    // storeId omitted means "every store" (RTS-305's all-stores view).
    @GetMapping("/stock-checks")
    public ResponseEntity<SuperAdminStockCheckHistoryPageResponse> historicalChecks(
        @RequestParam(required = false) Long storeId,
        @RequestParam(required = false) LocalDate startDate,
        @RequestParam(required = false) LocalDate endDate,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size
    ) {
        return ResponseEntity.ok(
            stockCheckService.listHistoricalChecksForSuperAdmin(storeId, startDate, endDate, page, size)
        );
    }

    // Matches the existing /stores/{storeId}/order-list/{entryId}/status
    // convention in SuperAdminOperationsController.
    @PatchMapping("/stores/{storeId}/stock-checks/{id}")
    public ResponseEntity<StockCheckResponse> correctCheck(
        @AuthenticationPrincipal SuperAdminUserDetails principal,
        @PathVariable Long storeId,
        @PathVariable Long id,
        @Valid @RequestBody StockCheckCorrectionRequest request
    ) {
        return ResponseEntity.ok(
            stockCheckService.correctCheckForSuperAdmin(storeId, id, principal.getSuperAdmin(), request)
        );
    }
}
