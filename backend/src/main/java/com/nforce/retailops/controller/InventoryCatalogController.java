package com.nforce.retailops.controller;

import com.nforce.retailops.dto.StatusRequest;
import com.nforce.retailops.dto.StockLevelComparisonRowResponse;
import com.nforce.retailops.dto.StoreInventoryItemRequest;
import com.nforce.retailops.dto.StoreInventoryItemResponse;
import com.nforce.retailops.service.StoreInventoryItemService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// Super Admin's Phase 2 inventory: full CRUD on every store's own inventory
// items (cross-store).
@RestController
@RequestMapping("/api/super-admin/inventory")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class InventoryCatalogController {

    private final StoreInventoryItemService storeInventoryItemService;

    public InventoryCatalogController(StoreInventoryItemService storeInventoryItemService) {
        this.storeInventoryItemService = storeInventoryItemService;
    }

    @GetMapping("/items")
    public ResponseEntity<List<StoreInventoryItemResponse>> listItems() {
        return ResponseEntity.ok(storeInventoryItemService.listAllForSuperAdmin());
    }

    @PostMapping("/items")
    public ResponseEntity<StoreInventoryItemResponse> createItem(@Valid @RequestBody StoreInventoryItemRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(storeInventoryItemService.createForSuperAdmin(request));
    }

    @PutMapping("/items/{id}")
    public ResponseEntity<StoreInventoryItemResponse> updateItem(
        @PathVariable Long id,
        @Valid @RequestBody StoreInventoryItemRequest request
    ) {
        return ResponseEntity.ok(storeInventoryItemService.updateForSuperAdmin(id, request));
    }

    @PatchMapping("/items/{id}/status")
    public ResponseEntity<StoreInventoryItemResponse> setItemStatus(
        @PathVariable Long id,
        @Valid @RequestBody StatusRequest request
    ) {
        return ResponseEntity.ok(storeInventoryItemService.setActiveForSuperAdmin(id, request.active()));
    }

    @DeleteMapping("/items/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable Long id) {
        storeInventoryItemService.deleteForSuperAdmin(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stock-comparison")
    public ResponseEntity<List<StockLevelComparisonRowResponse>> compareStockLevels(@RequestParam String itemName) {
        return ResponseEntity.ok(storeInventoryItemService.compareAcrossStores(itemName));
    }
}
