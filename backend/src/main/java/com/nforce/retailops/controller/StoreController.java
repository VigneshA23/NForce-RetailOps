package com.nforce.retailops.controller;

import com.nforce.retailops.dto.StoreRequest;
import com.nforce.retailops.dto.StoreResponse;
import com.nforce.retailops.dto.SuperAdminStoreResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.StoreService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/stores")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class StoreController {

    private final StoreService storeService;

    public StoreController(StoreService storeService) {
        this.storeService = storeService;
    }

    @GetMapping
    public ResponseEntity<List<StoreResponse>> list(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(storeService.listStores(principal.getUser().getId()));
    }

    // Read-only, cross-owner directory for the Super Admin's Stores page.
    @GetMapping("/all")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<SuperAdminStoreResponse>> listAll() {
        return ResponseEntity.ok(storeService.listAllStoresForSuperAdmin());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<StoreResponse> rename(
        @PathVariable Long id,
        @Valid @RequestBody StoreRequest request
    ) {
        return ResponseEntity.ok(storeService.renameStore(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        storeService.deleteStore(id);
        return ResponseEntity.noContent().build();
    }
}
