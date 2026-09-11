package com.nforce.retailops.controller;

import com.nforce.retailops.dto.EmployeeCreateRequest;
import com.nforce.retailops.dto.EmployeeCreationResponse;
import com.nforce.retailops.dto.EmployeeDirectoryResponse;
import com.nforce.retailops.dto.EmployeeResponse;
import com.nforce.retailops.dto.EmployeeUpdateRequest;
import com.nforce.retailops.dto.SuperAdminEmployeeResponse;
import com.nforce.retailops.dto.UpdateEmployeeStatusRequest;
import com.nforce.retailops.dto.UpdateEmployeeStoresRequest;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.EmployeeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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

    // Uses Authentication (not @AuthenticationPrincipal AppUserDetails) because Super
    // Admin uses SuperAdminUserDetails -- a different principal type -- and
    // @AuthenticationPrincipal with a typed parameter binds to null when the type
    // doesn't match, which NPEs on principal.getUser() for a real Super Admin.
    // Same idiom as ChecklistHistoryController's detail()/correctionHistory().
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'OWNER_ADMIN')")
    public ResponseEntity<EmployeeResponse> update(
        Authentication authentication,
        @PathVariable Long id,
        @Valid @RequestBody EmployeeUpdateRequest request
    ) {
        if (authentication.getPrincipal() instanceof AppUserDetails appUserDetails) {
            return ResponseEntity.ok(employeeService.updateEmployee(appUserDetails.getUser().getId(), id, request));
        }
        return ResponseEntity.ok(employeeService.updateEmployeeAsSuperAdmin(id, request));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'OWNER_ADMIN')")
    public ResponseEntity<EmployeeResponse> updateStatus(
        Authentication authentication,
        @PathVariable Long id,
        @Valid @RequestBody UpdateEmployeeStatusRequest request
    ) {
        if (authentication.getPrincipal() instanceof AppUserDetails appUserDetails) {
            return ResponseEntity.ok(employeeService.setEmployeeActive(appUserDetails.getUser().getId(), id, request));
        }
        return ResponseEntity.ok(employeeService.setEmployeeActiveAsSuperAdmin(id, request));
    }

    @PostMapping("/{id}/reset-password")
    public ResponseEntity<Void> resetPassword(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id
    ) {
        employeeService.resetEmployeePassword(principal.getUser().getId(), id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/stores")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<EmployeeResponse> updateStores(
        @PathVariable Long id,
        @RequestBody UpdateEmployeeStoresRequest request
    ) {
        return ResponseEntity.ok(employeeService.updateEmployeeStores(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        employeeService.deleteEmployeeAsSuperAdmin(id);
        return ResponseEntity.noContent().build();
    }

}
