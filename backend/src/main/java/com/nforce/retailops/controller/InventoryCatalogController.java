package com.nforce.retailops.controller;

import com.nforce.retailops.dto.AssignInventoryItemRequest;
import com.nforce.retailops.dto.InventoryCategoryRequest;
import com.nforce.retailops.dto.InventoryCategoryResponse;
import com.nforce.retailops.dto.InventoryItemRequest;
import com.nforce.retailops.dto.InventoryItemResponse;
import com.nforce.retailops.dto.StatusRequest;
import com.nforce.retailops.dto.StoreInventoryItemResponse;
import com.nforce.retailops.service.InventoryCatalogService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// Super Admin's global Phase 2 master catalog: inventory categories, items,
// and assigning items to specific stores.
@RestController
@RequestMapping("/api/super-admin/inventory")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class InventoryCatalogController {

    private final InventoryCatalogService inventoryCatalogService;

    public InventoryCatalogController(InventoryCatalogService inventoryCatalogService) {
        this.inventoryCatalogService = inventoryCatalogService;
    }

    @GetMapping("/categories")
    public ResponseEntity<List<InventoryCategoryResponse>> listCategories() {
        return ResponseEntity.ok(inventoryCatalogService.listCategories());
    }

    @PostMapping("/categories")
    public ResponseEntity<InventoryCategoryResponse> createCategory(@Valid @RequestBody InventoryCategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryCatalogService.createCategory(request));
    }

    @PutMapping("/categories/{id}")
    public ResponseEntity<InventoryCategoryResponse> updateCategory(
        @PathVariable Long id,
        @Valid @RequestBody InventoryCategoryRequest request
    ) {
        return ResponseEntity.ok(inventoryCatalogService.updateCategory(id, request));
    }

    @PatchMapping("/categories/{id}/status")
    public ResponseEntity<InventoryCategoryResponse> setCategoryStatus(
        @PathVariable Long id,
        @Valid @RequestBody StatusRequest request
    ) {
        return ResponseEntity.ok(inventoryCatalogService.setCategoryActive(id, request.active()));
    }

    @GetMapping("/items")
    public ResponseEntity<List<InventoryItemResponse>> listItems() {
        return ResponseEntity.ok(inventoryCatalogService.listItems());
    }

    @PostMapping("/items")
    public ResponseEntity<InventoryItemResponse> createItem(@Valid @RequestBody InventoryItemRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryCatalogService.createItem(request));
    }

    @PutMapping("/items/{id}")
    public ResponseEntity<InventoryItemResponse> updateItem(
        @PathVariable Long id,
        @Valid @RequestBody InventoryItemRequest request
    ) {
        return ResponseEntity.ok(inventoryCatalogService.updateItem(id, request));
    }

    @PatchMapping("/items/{id}/status")
    public ResponseEntity<InventoryItemResponse> setItemStatus(
        @PathVariable Long id,
        @Valid @RequestBody StatusRequest request
    ) {
        return ResponseEntity.ok(inventoryCatalogService.setItemActive(id, request.active()));
    }

    @GetMapping("/stores/{storeId}/assignments")
    public ResponseEntity<List<StoreInventoryItemResponse>> listAssignments(@PathVariable Long storeId) {
        return ResponseEntity.ok(inventoryCatalogService.listAssignmentsForStore(storeId));
    }

    @PostMapping("/assign")
    public ResponseEntity<StoreInventoryItemResponse> assignItemToStore(@Valid @RequestBody AssignInventoryItemRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryCatalogService.assignItemToStore(request));
    }
}
