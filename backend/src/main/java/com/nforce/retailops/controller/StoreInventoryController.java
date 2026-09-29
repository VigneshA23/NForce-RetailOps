package com.nforce.retailops.controller;

import com.nforce.retailops.dto.InventoryCategoryResponse;
import com.nforce.retailops.dto.StatusRequest;
import com.nforce.retailops.dto.StockCheckCorrectionRequest;
import com.nforce.retailops.dto.StockCheckHistoryPageResponse;
import com.nforce.retailops.dto.StockCheckResponse;
import com.nforce.retailops.dto.StoreInventoryItemRequest;
import com.nforce.retailops.dto.StoreInventoryItemResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.InventoryCatalogService;
import com.nforce.retailops.service.StockCheckService;
import com.nforce.retailops.service.StoreInventoryItemService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

// Owner/Admin's Phase 2 inventory: full CRUD on their own store's items,
// plus stock-check history review/correction, scoped to the caller's own
// (single) store.
@RestController
@RequestMapping("/api/stores/inventory")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class StoreInventoryController {

    private final StoreInventoryItemService storeInventoryItemService;
    private final InventoryCatalogService inventoryCatalogService;
    private final StockCheckService stockCheckService;

    public StoreInventoryController(
        StoreInventoryItemService storeInventoryItemService,
        InventoryCatalogService inventoryCatalogService,
        StockCheckService stockCheckService
    ) {
        this.storeInventoryItemService = storeInventoryItemService;
        this.inventoryCatalogService = inventoryCatalogService;
        this.stockCheckService = stockCheckService;
    }

    @GetMapping
    public ResponseEntity<List<StoreInventoryItemResponse>> list(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(storeInventoryItemService.listForOwner(principal.getUser().getId()));
    }

    // Read-only, so an owner can pick a category without needing Super
    // Admin's category-management access.
    @GetMapping("/categories")
    public ResponseEntity<List<InventoryCategoryResponse>> listCategories() {
        return ResponseEntity.ok(inventoryCatalogService.listActiveCategories());
    }

    @PostMapping
    public ResponseEntity<StoreInventoryItemResponse> create(
        @AuthenticationPrincipal AppUserDetails principal,
        @Valid @RequestBody StoreInventoryItemRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(storeInventoryItemService.createForOwner(principal.getUser().getId(), request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<StoreInventoryItemResponse> update(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id,
        @Valid @RequestBody StoreInventoryItemRequest request
    ) {
        return ResponseEntity.ok(storeInventoryItemService.updateForOwner(principal.getUser().getId(), id, request));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<StoreInventoryItemResponse> setStatus(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id,
        @Valid @RequestBody StatusRequest request
    ) {
        return ResponseEntity.ok(storeInventoryItemService.setActiveForOwner(principal.getUser().getId(), id, request.active()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AppUserDetails principal, @PathVariable Long id) {
        storeInventoryItemService.deleteForOwner(principal.getUser().getId(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stock-checks")
    public ResponseEntity<StockCheckHistoryPageResponse> historicalChecks(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam(required = false) LocalDate startDate,
        @RequestParam(required = false) LocalDate endDate,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size
    ) {
        return ResponseEntity.ok(
            stockCheckService.listHistoricalChecks(principal.getUser().getId(), startDate, endDate, page, size)
        );
    }

    @PatchMapping("/stock-checks/{id}")
    public ResponseEntity<StockCheckResponse> correctCheck(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id,
        @Valid @RequestBody StockCheckCorrectionRequest request
    ) {
        return ResponseEntity.ok(stockCheckService.correctCheck(principal.getUser().getId(), id, request));
    }
}
