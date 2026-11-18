package com.nforce.retailops.controller;

import com.nforce.retailops.dto.StoreCashTargetResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.StoreCashTargetService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

// Owner/Admin's read-only view of their own store's cash-drawer target, shown
// on Daily Cash. The target is edited from the store form (Super Admin), not here.
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
}
