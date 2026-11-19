package com.nforce.retailops.controller;

import com.nforce.retailops.dto.CashHistoryResponse;
import com.nforce.retailops.dto.DailyCashEntryRequest;
import com.nforce.retailops.dto.ExpectedCashAsOfResponse;
import com.nforce.retailops.dto.DailyCashEntryResponse;
import com.nforce.retailops.dto.ExpectedCashRangeResponse;
import com.nforce.retailops.dto.SuperAdminCashFlagRequest;
import com.nforce.retailops.security.SuperAdminUserDetails;
import com.nforce.retailops.service.CashHistoryService;
import com.nforce.retailops.service.DailyCashEntryService;
import com.nforce.retailops.service.SuperAdminCashFlagService;
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
    private final CashHistoryService historyService;
    private final SuperAdminCashFlagService flagService;

    public SuperAdminStoreCashController(
        DailyCashEntryService service,
        CashHistoryService historyService,
        SuperAdminCashFlagService flagService
    ) {
        this.service = service;
        this.historyService = historyService;
        this.flagService = flagService;
    }

    // Flag an entry with a note (at least 5 words); the entering employee, and
    // only they, is notified.
    @PostMapping("/entries/{entryId}/flag")
    public ResponseEntity<DailyCashEntryResponse> raiseFlag(
        @AuthenticationPrincipal SuperAdminUserDetails principal,
        @PathVariable Long storeId,
        @PathVariable Long entryId,
        @Valid @RequestBody SuperAdminCashFlagRequest request
    ) {
        return ResponseEntity.ok(
            flagService.raise(principal.getSuperAdmin().getId(), storeId, entryId, request.comment()));
    }

    @PatchMapping("/entries/{entryId}/flag")
    public ResponseEntity<DailyCashEntryResponse> editFlag(
        @AuthenticationPrincipal SuperAdminUserDetails principal,
        @PathVariable Long storeId,
        @PathVariable Long entryId,
        @Valid @RequestBody SuperAdminCashFlagRequest request
    ) {
        return ResponseEntity.ok(
            flagService.editComment(principal.getSuperAdmin().getId(), storeId, entryId, request.comment()));
    }

    @DeleteMapping("/entries/{entryId}/flag")
    public ResponseEntity<DailyCashEntryResponse> removeFlag(
        @AuthenticationPrincipal SuperAdminUserDetails principal,
        @PathVariable Long storeId,
        @PathVariable Long entryId
    ) {
        return ResponseEntity.ok(
            flagService.remove(principal.getSuperAdmin().getId(), storeId, entryId));
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

    @GetMapping("/expected-as-of")
    public ResponseEntity<ExpectedCashAsOfResponse> expectedAsOf(
        @PathVariable Long storeId,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return ResponseEntity.ok(service.getExpectedAsOfForSuperAdmin(storeId, date));
    }

    @GetMapping("/history")
    public ResponseEntity<CashHistoryResponse> history(
        @PathVariable Long storeId,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(historyService.forSuperAdmin(storeId, from, to, status));
    }

    // Sum of daily expected cash over [from, to] inclusive. Days with no
    // entry add 0.
    @GetMapping("/expected-cash-on-hand")
    public ResponseEntity<ExpectedCashRangeResponse> rangeSum(
        @PathVariable Long storeId,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(service.getRangeSumForSuperAdmin(storeId, from, to));
    }
}
