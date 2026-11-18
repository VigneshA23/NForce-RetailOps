package com.nforce.retailops.controller;

import com.nforce.retailops.dto.CashHistoryResponse;
import com.nforce.retailops.dto.DailyCashEntryRequest;
import com.nforce.retailops.dto.ExpectedCashAsOfResponse;
import com.nforce.retailops.dto.SuperAdminCashFlagRequest;
import com.nforce.retailops.dto.DailyCashEntryResponse;
import com.nforce.retailops.dto.ExpectedCashRangeResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.CashHistoryService;
import com.nforce.retailops.service.DailyCashEntryService;
import com.nforce.retailops.service.OwnerCashFlagService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

// Owner/Admin's daily store cash entry, scoped to the caller's own store.
@RestController
@RequestMapping("/api/stores/cash")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class StoreCashController {

    private final DailyCashEntryService service;
    private final OwnerCashFlagService flagService;
    private final CashHistoryService historyService;

    public StoreCashController(
        DailyCashEntryService service, OwnerCashFlagService flagService, CashHistoryService historyService
    ) {
        this.service = service;
        this.flagService = flagService;
        this.historyService = historyService;
    }

    // Create-or-update: the entry for (own store, businessDate); 200 either way.
    @PutMapping
    public ResponseEntity<DailyCashEntryResponse> save(
        @AuthenticationPrincipal AppUserDetails principal,
        @Valid @RequestBody DailyCashEntryRequest request
    ) {
        return ResponseEntity.ok(service.save(principal.getUser().getId(), request));
    }

    // 404 when no entry exists for the date (default today).
    @GetMapping
    public ResponseEntity<DailyCashEntryResponse> get(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return ResponseEntity.ok(service.get(principal.getUser().getId(), date));
    }

    // Expected cash on hand as of a date (default today), even when that day
    // has no entry of its own.
    @GetMapping("/expected-as-of")
    public ResponseEntity<ExpectedCashAsOfResponse> expectedAsOf(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return ResponseEntity.ok(service.getExpectedAsOf(principal.getUser().getId(), date));
    }

    // Flag an entry with a comment (at least 5 words); the entering employee,
    // and only they, is notified.
    @PostMapping("/entries/{entryId}/flag")
    public ResponseEntity<DailyCashEntryResponse> raiseFlag(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long entryId,
        @Valid @RequestBody SuperAdminCashFlagRequest request
    ) {
        return ResponseEntity.ok(flagService.raise(principal.getUser().getId(), entryId, request.comment()));
    }

    @PatchMapping("/entries/{entryId}/flag")
    public ResponseEntity<DailyCashEntryResponse> editFlag(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long entryId,
        @Valid @RequestBody SuperAdminCashFlagRequest request
    ) {
        return ResponseEntity.ok(flagService.editComment(principal.getUser().getId(), entryId, request.comment()));
    }

    @DeleteMapping("/entries/{entryId}/flag")
    public ResponseEntity<DailyCashEntryResponse> removeFlag(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long entryId
    ) {
        return ResponseEntity.ok(flagService.remove(principal.getUser().getId(), entryId));
    }

    // Append-only history of the store's entries: status = OPEN | RESOLVED.
    @GetMapping("/history")
    public ResponseEntity<CashHistoryResponse> history(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(historyService.forOwner(principal.getUser().getId(), from, to, status));
    }

    // Sum of daily expected cash for the Owner/Admin's own store over
    // [from, to] inclusive. Days with no entry inside the range add 0, so 0
    // comes back when the range has none.
    @GetMapping("/expected-cash-on-hand")
    public ResponseEntity<ExpectedCashRangeResponse> rangeSum(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ResponseEntity.ok(service.getRangeSum(principal.getUser().getId(), from, to));
    }
}
