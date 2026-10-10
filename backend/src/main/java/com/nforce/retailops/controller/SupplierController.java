package com.nforce.retailops.controller;

import com.nforce.retailops.dto.StatusRequest;
import com.nforce.retailops.dto.SupplierDeleteResponse;
import com.nforce.retailops.dto.SupplierDetailsRequest;
import com.nforce.retailops.dto.SupplierResponse;
import com.nforce.retailops.service.SupplierService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/super-admin/suppliers")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SupplierController {

    private final SupplierService supplierService;

    public SupplierController(SupplierService supplierService) {
        this.supplierService = supplierService;
    }

    @GetMapping
    public ResponseEntity<List<SupplierResponse>> list() {
        return ResponseEntity.ok(supplierService.listSuppliers());
    }

    @PostMapping
    public ResponseEntity<SupplierResponse> create(@Valid @RequestBody SupplierDetailsRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(supplierService.createSupplierWithDetails(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SupplierResponse> update(@PathVariable Long id, @Valid @RequestBody SupplierDetailsRequest request) {
        return ResponseEntity.ok(supplierService.updateSupplierWithDetails(id, request));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<SupplierResponse> setStatus(@PathVariable Long id, @Valid @RequestBody StatusRequest request) {
        return ResponseEntity.ok(supplierService.setSupplierActive(id, request.active()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<SupplierDeleteResponse> delete(@PathVariable Long id) {
        return ResponseEntity.ok(supplierService.deleteSupplier(id));
    }
}
