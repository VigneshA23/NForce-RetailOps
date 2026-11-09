package com.nforce.retailops.controller;

import com.nforce.retailops.dto.ExpectedCashResponse;
import com.nforce.retailops.service.CashCalculationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Super Admin: expected cash on hand for any store, chosen in the path.
@RestController
@RequestMapping("/api/super-admin/stores/{storeId}/cash/expected")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminStoreExpectedCashController {

    private final CashCalculationService service;

    public SuperAdminStoreExpectedCashController(CashCalculationService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<ExpectedCashResponse> get(@PathVariable Long storeId) {
        return ResponseEntity.ok(service.getExpectedCashForSuperAdmin(storeId));
    }
}
