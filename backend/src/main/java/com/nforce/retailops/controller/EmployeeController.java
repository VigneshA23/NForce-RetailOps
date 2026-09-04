package com.nforce.retailops.controller;

import com.nforce.retailops.dto.EmployeeCreateRequest;
import com.nforce.retailops.dto.EmployeeCreationResponse;
import com.nforce.retailops.dto.EmployeeDirectoryResponse;
import com.nforce.retailops.dto.EmployeeResponse;
import com.nforce.retailops.dto.EmployeeUpdateRequest;
import com.nforce.retailops.dto.SuperAdminEmployeeResponse;
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

    // Read-only, cross-owner directory for the Super Admin's Employees page.
    @GetMapping("/all")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<SuperAdminEmployeeResponse>> listAll() {
        return ResponseEntity.ok(employeeService.listAllEmployeesForSuperAdmin());
    }

    // Cross-owner directory for the Owner's "Assign Employee" flow -- find an
    // existing (Super-Admin-created) employee and add my own store to them.
    @GetMapping("/directory")
    public ResponseEntity<List<EmployeeDirectoryResponse>> directory(
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return ResponseEntity.ok(employeeService.listDirectory(principal.getUser().getId()));
    }

    @PostMapping("/{id}/assignment")
    public ResponseEntity<EmployeeResponse> assign(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id
    ) {
        return ResponseEntity.ok(employeeService.assignToMyStore(principal.getUser().getId(), id));
    }

    @DeleteMapping("/{id}/assignment")
    public ResponseEntity<EmployeeResponse> unassign(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id
    ) {
        return ResponseEntity.ok(employeeService.unassignFromMyStore(principal.getUser().getId(), id));
    }

    // Super-Admin-only: creates the employee account with no store. An owner
    // assigns their own store to it afterward via POST /{id}/assignment.
    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<EmployeeCreationResponse> create(@Valid @RequestBody EmployeeCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(employeeService.createEmployee(request));
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

    @PostMapping("/{id}/reset-password")
    public ResponseEntity<Void> resetPassword(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id
    ) {
        employeeService.resetEmployeePassword(principal.getUser().getId(), id);
        return ResponseEntity.noContent().build();
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
