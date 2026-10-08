package com.nforce.retailops.controller;

import com.nforce.retailops.dto.EodSupplierReportResponse;
import com.nforce.retailops.dto.InventoryCountHistoryEntryResponse;
import com.nforce.retailops.dto.InventoryCountsPageResponse;
import com.nforce.retailops.dto.StatusRequest;
import com.nforce.retailops.dto.StockCheckCorrectionRequest;
import com.nforce.retailops.dto.StockCheckHistoryPageResponse;
import com.nforce.retailops.dto.StockCheckResponse;
import com.nforce.retailops.dto.StoreInventoryItemRequest;
import com.nforce.retailops.dto.StoreInventoryItemResponse;
import com.nforce.retailops.security.AppUserDetails;
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
    private final StockCheckService stockCheckService;

    public StoreInventoryController(
        StoreInventoryItemService storeInventoryItemService,
        StockCheckService stockCheckService
    ) {
        this.storeInventoryItemService = storeInventoryItemService;
        this.stockCheckService = stockCheckService;
    }

    @GetMapping
    public ResponseEntity<List<StoreInventoryItemResponse>> list(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(storeInventoryItemService.listForOwner(principal.getUser().getId()));
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

    // End of Day supplier report for one business day (default today).
    @GetMapping("/eod-report")
    public ResponseEntity<EodSupplierReportResponse> eodReport(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam(required = false) LocalDate date
    ) {
        return ResponseEntity.ok(stockCheckService.getEodSupplierReport(principal.getUser().getId(), date));
    }

    // Literal path, so it cannot collide with the {id} mapping below.
    @GetMapping("/counts")
    public ResponseEntity<InventoryCountsPageResponse> inventoryCounts(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String category,
        @RequestParam(required = false) String level,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer size
    ) {
        return ResponseEntity.ok(
            stockCheckService.listInventoryCounts(principal.getUser().getId(), search, category, level, page, size)
        );
    }

    @GetMapping("/counts/{itemId}/history")
    public ResponseEntity<List<InventoryCountHistoryEntryResponse>> countHistory(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long itemId
    ) {
        return ResponseEntity.ok(stockCheckService.getCountHistory(principal.getUser().getId(), itemId));
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
