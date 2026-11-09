package com.nforce.retailops.controller;

import com.nforce.retailops.dto.StoreCashTargetRequest;
import com.nforce.retailops.dto.StoreCashTargetResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.StoreCashTargetService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

// Owner/Admin's cash-drawer target for their own store.
@RestController
@RequestMapping("/api/stores/cash-target")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class StoreCashTargetController {

    private final StoreCashTargetService service;

    public StoreCashTargetController(StoreCashTargetService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<StoreCashTargetResponse> get(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(service.get(principal.getUser().getId()));
    }

    @PutMapping
    public ResponseEntity<StoreCashTargetResponse> update(
        @AuthenticationPrincipal AppUserDetails principal,
        @Valid @RequestBody StoreCashTargetRequest request
    ) {
        return ResponseEntity.ok(service.update(principal.getUser().getId(), request));
    }
}
