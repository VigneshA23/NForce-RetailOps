package com.nforce.retailops.controller;

import com.nforce.retailops.dto.StoreCashTargetRequest;
import com.nforce.retailops.dto.StoreCashTargetResponse;
import com.nforce.retailops.security.SuperAdminUserDetails;
import com.nforce.retailops.service.StoreCashTargetService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

// Super Admin's cash-drawer target for any store, chosen in the path.
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

    @PutMapping
    public ResponseEntity<StoreCashTargetResponse> update(
        @AuthenticationPrincipal SuperAdminUserDetails principal,
        @PathVariable Long storeId,
        @Valid @RequestBody StoreCashTargetRequest request
    ) {
        return ResponseEntity.ok(service.updateForSuperAdmin(principal.getSuperAdmin().getId(), storeId, request));
    }
}
