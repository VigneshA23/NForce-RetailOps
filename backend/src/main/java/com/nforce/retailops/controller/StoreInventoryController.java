package com.nforce.retailops.controller;

import com.nforce.retailops.dto.StockCheckCorrectionRequest;
import com.nforce.retailops.dto.StockCheckResponse;
import com.nforce.retailops.dto.StoreInventoryItemConfigRequest;
import com.nforce.retailops.dto.StoreInventoryItemResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.StockCheckService;
import com.nforce.retailops.service.StoreInventoryService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

// Owner/Admin's Phase 2 store-inventory configuration and stock-check
// history review, scoped to the caller's own (single) store.
@RestController
@RequestMapping("/api/stores/inventory")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class StoreInventoryController {

    private final StoreInventoryService storeInventoryService;
    private final StockCheckService stockCheckService;

    public StoreInventoryController(StoreInventoryService storeInventoryService, StockCheckService stockCheckService) {
        this.storeInventoryService = storeInventoryService;
        this.stockCheckService = stockCheckService;
    }

    @GetMapping
    public ResponseEntity<List<StoreInventoryItemResponse>> list(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(storeInventoryService.listStoreItems(principal.getUser().getId()));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<StoreInventoryItemResponse> updateConfig(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id,
        @RequestBody StoreInventoryItemConfigRequest request
    ) {
        return ResponseEntity.ok(storeInventoryService.updateConfig(principal.getUser().getId(), id, request));
    }

    @GetMapping("/stock-checks")
    public ResponseEntity<List<StockCheckResponse>> historicalChecks(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam LocalDate startDate,
        @RequestParam LocalDate endDate
    ) {
        return ResponseEntity.ok(stockCheckService.listHistoricalChecks(principal.getUser().getId(), startDate, endDate));
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
