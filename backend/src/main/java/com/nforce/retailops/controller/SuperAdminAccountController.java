package com.nforce.retailops.controller;

import com.nforce.retailops.dto.StatusRequest;
import com.nforce.retailops.dto.SuperAdminAccountResponse;
import com.nforce.retailops.security.SuperAdminUserDetails;
import com.nforce.retailops.service.SuperAdminAccountService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

// Super Admin revocation (security audit VULN-10). Super Admin only; the
// rules on who may change whom live in SuperAdminAccountService.
@RestController
@RequestMapping("/api/super-admin/super-admins")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminAccountController {

    private final SuperAdminAccountService service;

    public SuperAdminAccountController(SuperAdminAccountService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<SuperAdminAccountResponse>> list() {
        return ResponseEntity.ok(service.list());
    }

    // { "active": false } deactivates and ends all of that Super Admin's
    // sessions; { "active": true } reactivates.
    @PatchMapping("/{id}/status")
    public ResponseEntity<SuperAdminAccountResponse> setStatus(
        @AuthenticationPrincipal SuperAdminUserDetails principal,
        @PathVariable Long id,
        @Valid @RequestBody StatusRequest request
    ) {
        return ResponseEntity.ok(service.setActive(principal.getSuperAdmin().getId(), id, request.active()));
    }
}
