package com.nforce.retailops.controller;

import com.nforce.retailops.dto.AssignedStoreResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.OwnerStoreAccessService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * The stores the signed-in Owner/Admin is actively linked to. Drives the store
 * picker: none shows the empty state, one is selected automatically, two or
 * more ask the admin to choose. Same shape as the employee store list.
 * Deliberately exempt from StoreScopeInterceptor, so an admin whose selected
 * store was revoked can still fetch this list to recover.
 */
@RestController
@RequestMapping("/api/owner-stores")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class OwnerStoreController {

    private final OwnerStoreAccessService ownerStoreAccessService;

    public OwnerStoreController(OwnerStoreAccessService ownerStoreAccessService) {
        this.ownerStoreAccessService = ownerStoreAccessService;
    }

    @GetMapping
    public ResponseEntity<List<AssignedStoreResponse>> list(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(ownerStoreAccessService.activeLinks(principal.getUser().getId()).stream()
            .map(link -> AssignedStoreResponse.from(link.getStore()))
            .toList());
    }
}
