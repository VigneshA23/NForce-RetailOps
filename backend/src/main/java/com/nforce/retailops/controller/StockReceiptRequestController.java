package com.nforce.retailops.controller;

import com.nforce.retailops.dto.StockReceiptRequestResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.StockReceiptApprovalService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Owner/Admin approves or rejects an employee's received-stock request,
// scoped to the caller's own store.
@RestController
@RequestMapping("/api/stores/stock-receipt-requests")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class StockReceiptRequestController {

    private final StockReceiptApprovalService approvalService;

    public StockReceiptRequestController(StockReceiptApprovalService approvalService) {
        this.approvalService = approvalService;
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<StockReceiptRequestResponse> approve(
        @AuthenticationPrincipal AppUserDetails principal, @PathVariable Long id
    ) {
        return ResponseEntity.ok(approvalService.approve(principal.getUser().getId(), id));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<StockReceiptRequestResponse> reject(
        @AuthenticationPrincipal AppUserDetails principal, @PathVariable Long id
    ) {
        return ResponseEntity.ok(approvalService.reject(principal.getUser().getId(), id));
    }
}
