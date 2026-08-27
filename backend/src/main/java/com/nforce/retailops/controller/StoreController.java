package com.nforce.retailops.controller;

<<<<<<< Updated upstream
import com.nforce.retailops.dto.StoreRequest;
import com.nforce.retailops.dto.StoreResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.StoreService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
=======
import com.nforce.retailops.dto.StoreSummaryResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.DashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
>>>>>>> Stashed changes

import java.util.List;

@RestController
@RequestMapping("/api/stores")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class StoreController {

<<<<<<< Updated upstream
    private final StoreService storeService;

    public StoreController(StoreService storeService) {
        this.storeService = storeService;
    }

    @GetMapping
    public ResponseEntity<List<StoreResponse>> list(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(storeService.listStores(principal.getUser().getId()));
    }

    @PostMapping
    public ResponseEntity<StoreResponse> create(
        @AuthenticationPrincipal AppUserDetails principal,
        @Valid @RequestBody StoreRequest request
    ) {
        StoreResponse created = storeService.createStore(principal.getUser().getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<StoreResponse> rename(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id,
        @Valid @RequestBody StoreRequest request
    ) {
        return ResponseEntity.ok(storeService.renameStore(principal.getUser().getId(), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id
    ) {
        storeService.deleteStore(principal.getUser().getId(), id);
        return ResponseEntity.noContent().build();
=======
    private final DashboardService dashboardService;

    public StoreController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    public ResponseEntity<List<StoreSummaryResponse>> listStores(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(dashboardService.listOwnedStores(principal.getUser()));
>>>>>>> Stashed changes
    }
}
