package com.nforce.retailops.controller;

import com.nforce.retailops.dto.DailyCashEntryRequest;
import com.nforce.retailops.dto.DailyCashEntryResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.DailyCashEntryService;
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

    public StoreCashController(DailyCashEntryService service) {
        this.service = service;
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
}
