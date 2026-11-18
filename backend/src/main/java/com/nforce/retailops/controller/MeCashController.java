package com.nforce.retailops.controller;

import com.nforce.retailops.dto.CashHistoryResponse;
import com.nforce.retailops.dto.DailyCashEntryRequest;
import com.nforce.retailops.dto.DailyCashEntryResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.CashHistoryService;
import com.nforce.retailops.service.DailyCashEntryService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

// An employee's daily cash entry for a store they work at. Store isolation is
// the service's requireAssignedStore (an unassigned store is a 404, not a 403),
// and an employee can only write today's entry.
@RestController
@RequestMapping("/api/me/cash")
@PreAuthorize("hasRole('EMPLOYEE')")
public class MeCashController {

    private final DailyCashEntryService service;
    private final CashHistoryService historyService;

    public MeCashController(DailyCashEntryService service, CashHistoryService historyService) {
        this.service = service;
        this.historyService = historyService;
    }

    // Create-or-update today's entry; 200 either way, 403 for any other date.
    @PutMapping
    public ResponseEntity<DailyCashEntryResponse> save(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam Long storeId,
        @Valid @RequestBody DailyCashEntryRequest request
    ) {
        return ResponseEntity.ok(service.saveForEmployee(principal.getUser().getId(), storeId, request));
    }

    // History of the entries this employee entered (never anyone else's).
    @GetMapping("/history")
    public ResponseEntity<CashHistoryResponse> history(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam Long storeId,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(
            historyService.forEmployee(principal.getUser().getId(), storeId, from, to, status));
    }

    // 404 when no entry exists for the date (default today).
    @GetMapping
    public ResponseEntity<DailyCashEntryResponse> get(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam Long storeId,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date
    ) {
        return ResponseEntity.ok(service.getForEmployee(principal.getUser().getId(), storeId, date));
    }
}
