package com.nforce.retailops.controller;

import com.nforce.retailops.dto.SuperAdminCashCorrectionRequest;
import com.nforce.retailops.dto.SuperAdminCashFlagRequest;
import com.nforce.retailops.dto.SuperAdminCashReviewResponse;
import com.nforce.retailops.security.SuperAdminUserDetails;
import com.nforce.retailops.service.SuperAdminCashReviewService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

// Super Admin's one-store-at-a-time cash review page: pick a store, pick a
// date, see the entry, the running expected cash on hand, the target, and
// correct or flag the entry. All four write endpoints return the refreshed
// review payload so the UI reconciles against one source.
@RestController
@RequestMapping("/api/super-admin/stores/{storeId}/cash/review")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminCashReviewController {

    private final SuperAdminCashReviewService service;

    public SuperAdminCashReviewController(SuperAdminCashReviewService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<SuperAdminCashReviewResponse> get(
        @PathVariable Long storeId,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return ResponseEntity.ok(service.get(storeId, date));
    }

    @PutMapping("/entries/{entryId}/correct")
    public ResponseEntity<SuperAdminCashReviewResponse> correct(
        @AuthenticationPrincipal SuperAdminUserDetails principal,
        @PathVariable Long storeId,
        @PathVariable Long entryId,
        @Valid @RequestBody SuperAdminCashCorrectionRequest request
    ) {
        return ResponseEntity.ok(
            service.correct(principal.getSuperAdmin().getId(), storeId, entryId, request));
    }

    @PostMapping("/entries/{entryId}/flag")
    public ResponseEntity<SuperAdminCashReviewResponse> raiseFlag(
        @AuthenticationPrincipal SuperAdminUserDetails principal,
        @PathVariable Long storeId,
        @PathVariable Long entryId,
        @Valid @RequestBody SuperAdminCashFlagRequest request
    ) {
        return ResponseEntity.ok(
            service.raiseFlag(principal.getSuperAdmin().getId(), storeId, entryId, request));
    }

    @PatchMapping("/entries/{entryId}/flag")
    public ResponseEntity<SuperAdminCashReviewResponse> editFlag(
        @AuthenticationPrincipal SuperAdminUserDetails principal,
        @PathVariable Long storeId,
        @PathVariable Long entryId,
        @Valid @RequestBody SuperAdminCashFlagRequest request
    ) {
        return ResponseEntity.ok(
            service.editFlag(principal.getSuperAdmin().getId(), storeId, entryId, request));
    }

    @DeleteMapping("/entries/{entryId}/flag")
    public ResponseEntity<SuperAdminCashReviewResponse> removeFlag(
        @AuthenticationPrincipal SuperAdminUserDetails principal,
        @PathVariable Long storeId,
        @PathVariable Long entryId
    ) {
        return ResponseEntity.ok(
            service.removeFlag(principal.getSuperAdmin().getId(), storeId, entryId));
    }
}
