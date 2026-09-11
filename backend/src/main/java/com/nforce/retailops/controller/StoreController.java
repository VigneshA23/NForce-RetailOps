package com.nforce.retailops.controller;

import com.nforce.retailops.dto.AssignStoreOwnerRequest;
import com.nforce.retailops.dto.CreateStoreRequest;
import com.nforce.retailops.dto.StoreRequest;
import com.nforce.retailops.dto.StoreResponse;
import com.nforce.retailops.dto.SuperAdminStoreResponse;
import com.nforce.retailops.dto.SupplierResponse;
import com.nforce.retailops.dto.UpdateStoreStatusRequest;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.StoreService;
import com.nforce.retailops.service.SupplierService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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
    private final SupplierService supplierService;

    public StoreController(StoreService storeService, SupplierService supplierService) {
        this.storeService = storeService;
        this.supplierService = supplierService;
    }

    @GetMapping
    public ResponseEntity<List<StoreResponse>> list(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(storeService.listStores(principal.getUser().getId()));
    }

    // Read-only global supplier directory, so an owner can pick a preferred/order
    // supplier without needing Super Admin's supplier-management access.
    @GetMapping("/suppliers")
    public ResponseEntity<List<SupplierResponse>> listSuppliers() {
        return ResponseEntity.ok(supplierService.listSuppliers());
    }

    // Read-only, cross-owner directory for the Super Admin's Stores page.
    @GetMapping("/all")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<SuperAdminStoreResponse>> listAll() {
        return ResponseEntity.ok(storeService.listAllStoresForSuperAdmin());
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<SuperAdminStoreResponse> createUnownedStore(@Valid @RequestBody CreateStoreRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(storeService.createUnownedStore(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<SuperAdminStoreResponse> update(
        @PathVariable Long id,
        @Valid @RequestBody StoreRequest request
    ) {
        return ResponseEntity.ok(storeService.updateStore(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        storeService.deleteStore(id);
        return ResponseEntity.noContent().build();
    }

    // Toggles the store's OWN active/inactive status -- not to be confused
    // with PATCH /api/owners/{ownerId}/stores/{storeId}/status, which toggles
    // an owner's access to a store instead.
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<SuperAdminStoreResponse> updateStatus(
        @PathVariable Long id,
        @Valid @RequestBody UpdateStoreStatusRequest request
    ) {
        return ResponseEntity.ok(storeService.setStoreActive(id, request.active()));
    }

    // Assigns or reassigns which owner manages a store.
    // Guard: target owner must not already manage a different active store.
    @PatchMapping("/{id}/assign-owner")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<SuperAdminStoreResponse> assignOwner(
        @PathVariable Long id,
        @Valid @RequestBody AssignStoreOwnerRequest request
    ) {
        return ResponseEntity.ok(storeService.assignOwnerToStore(id, request.ownerId()));
    }
}
