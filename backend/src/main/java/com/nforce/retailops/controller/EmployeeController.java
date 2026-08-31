package com.nforce.retailops.controller;

import com.nforce.retailops.dto.EmployeeCreateRequest;
import com.nforce.retailops.dto.EmployeeResponse;
import com.nforce.retailops.dto.EmployeeUpdateRequest;
import com.nforce.retailops.dto.StoreOptionResponse;
import com.nforce.retailops.dto.UpdateEmployeeStatusRequest;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.EmployeeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/employees")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class EmployeeController {

    private final EmployeeService employeeService;

    public EmployeeController(EmployeeService employeeService) {
        this.employeeService = employeeService;
    }

    @GetMapping
    public ResponseEntity<List<EmployeeResponse>> list(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(employeeService.listEmployees(principal.getUser().getId()));
    }

    @GetMapping("/stores")
    public ResponseEntity<List<StoreOptionResponse>> assignableStores(
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return ResponseEntity.ok(employeeService.listAssignableStores(principal.getUser().getId()));
    }

    @PostMapping
    public ResponseEntity<EmployeeResponse> create(
        @AuthenticationPrincipal AppUserDetails principal,
        @Valid @RequestBody EmployeeCreateRequest request
    ) {
        EmployeeResponse created = employeeService.createEmployee(principal.getUser().getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<EmployeeResponse> update(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id,
        @Valid @RequestBody EmployeeUpdateRequest request
    ) {
        return ResponseEntity.ok(employeeService.updateEmployee(principal.getUser().getId(), id, request));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<EmployeeResponse> updateStatus(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id,
        @Valid @RequestBody UpdateEmployeeStatusRequest request
    ) {
        return ResponseEntity.ok(employeeService.setEmployeeActive(principal.getUser().getId(), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id
    ) {
        employeeService.deleteEmployee(principal.getUser().getId(), id);
        return ResponseEntity.noContent().build();
    }
}
