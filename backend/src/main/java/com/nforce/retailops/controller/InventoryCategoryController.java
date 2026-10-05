package com.nforce.retailops.controller;

import com.nforce.retailops.dto.InventoryCategoryRequest;
import com.nforce.retailops.dto.InventoryCategoryResponse;
import com.nforce.retailops.dto.StatusRequest;
import com.nforce.retailops.service.InventoryCategoryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/super-admin/inventory-categories")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class InventoryCategoryController {

    private final InventoryCategoryService inventoryCategoryService;

    public InventoryCategoryController(InventoryCategoryService inventoryCategoryService) {
        this.inventoryCategoryService = inventoryCategoryService;
    }

    @GetMapping
    public ResponseEntity<List<InventoryCategoryResponse>> list() {
        return ResponseEntity.ok(inventoryCategoryService.listCategories());
    }

    @PostMapping
    public ResponseEntity<InventoryCategoryResponse> create(@Valid @RequestBody InventoryCategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryCategoryService.createCategory(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<InventoryCategoryResponse> update(@PathVariable Long id, @Valid @RequestBody InventoryCategoryRequest request) {
        return ResponseEntity.ok(inventoryCategoryService.updateCategory(id, request));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<InventoryCategoryResponse> setStatus(@PathVariable Long id, @Valid @RequestBody StatusRequest request) {
        return ResponseEntity.ok(inventoryCategoryService.setCategoryActive(id, request.active()));
    }
}
