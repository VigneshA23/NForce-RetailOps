package com.nforce.retailops.controller;

import com.nforce.retailops.dto.AddOwnerRequest;
import com.nforce.retailops.dto.OwnerResponse;
import com.nforce.retailops.dto.UpdateOwnerStatusRequest;
import com.nforce.retailops.service.OwnerManagementService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminController {

    private final OwnerManagementService ownerManagementService;

    public SuperAdminController(OwnerManagementService ownerManagementService) {
        this.ownerManagementService = ownerManagementService;
    }

    @GetMapping("/owners")
    public ResponseEntity<List<OwnerResponse>> listOwners() {
        return ResponseEntity.ok(ownerManagementService.listOwners());
    }

    @PostMapping("/addowners")
    public ResponseEntity<OwnerResponse> addOwner(@Valid @RequestBody AddOwnerRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ownerManagementService.addOwner(request));
    }

    @PatchMapping("/owners/{ownerId}/status")
    public ResponseEntity<List<OwnerResponse>> updateOwnerStatus(
        @PathVariable Long ownerId,
        @Valid @RequestBody UpdateOwnerStatusRequest request
    ) {
        return ResponseEntity.ok(ownerManagementService.setOwnerActive(ownerId, request.active()));
    }
}
