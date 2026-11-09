package com.nforce.retailops.controller;

import com.nforce.retailops.dto.ExpectedCashResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.CashCalculationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Owner/Admin: expected cash on hand for their own store. 200 with
// available=false (never a fake 0) when the store has no cash entries.
@RestController
@RequestMapping("/api/stores/cash/expected")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class StoreExpectedCashController {

    private final CashCalculationService service;

    public StoreExpectedCashController(CashCalculationService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<ExpectedCashResponse> get(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(service.getExpectedCashForOwner(principal.getUser().getId()));
    }
}
