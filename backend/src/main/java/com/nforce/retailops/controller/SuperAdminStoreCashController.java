package com.nforce.retailops.controller;

import com.nforce.retailops.dto.DailyCashEntryRequest;
import com.nforce.retailops.dto.DailyCashEntryResponse;
import com.nforce.retailops.security.SuperAdminUserDetails;
import com.nforce.retailops.service.DailyCashEntryService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

// Super Admin's daily cash entry: same service and audit trail as
// StoreCashController, but the store is chosen explicitly in the path.
@RestController
@RequestMapping("/api/super-admin/stores/{storeId}/cash")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminStoreCashController {

    private final DailyCashEntryService service;

    public SuperAdminStoreCashController(DailyCashEntryService service) {
        this.service = service;
    }

    @PutMapping
    public ResponseEntity<DailyCashEntryResponse> save(
        @AuthenticationPrincipal SuperAdminUserDetails principal,
        @PathVariable Long storeId,
        @Valid @RequestBody DailyCashEntryRequest request
    ) {
        return ResponseEntity.ok(
            service.saveForSuperAdmin(principal.getSuperAdmin().getId(), storeId, request));
    }

    @GetMapping
    public ResponseEntity<DailyCashEntryResponse> get(
        @PathVariable Long storeId,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return ResponseEntity.ok(service.getForSuperAdmin(storeId, date));
    }
}
