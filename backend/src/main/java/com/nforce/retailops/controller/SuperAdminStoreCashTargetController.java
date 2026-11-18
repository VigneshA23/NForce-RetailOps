package com.nforce.retailops.controller;

import com.nforce.retailops.dto.StoreCashTargetResponse;
import com.nforce.retailops.service.StoreCashTargetService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

// Super Admin's read-only view of any store's cash-drawer target, chosen in
// the path. The target is edited from the store form, not here.
@RestController
@RequestMapping("/api/super-admin/stores/{storeId}/cash-target")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminStoreCashTargetController {

    private final StoreCashTargetService service;

    public SuperAdminStoreCashTargetController(StoreCashTargetService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<StoreCashTargetResponse> get(@PathVariable Long storeId) {
        return ResponseEntity.ok(service.getForSuperAdmin(storeId));
    }
}
