package com.nforce.retailops.controller;

<<<<<<< Updated upstream
import com.nforce.retailops.dto.EmployeeCreateRequest;
import com.nforce.retailops.dto.EmployeeResponse;
import com.nforce.retailops.dto.EmployeeUpdateRequest;
import com.nforce.retailops.dto.StoreOptionResponse;
=======
import com.nforce.retailops.dto.CreateEmployeeRequest;
import com.nforce.retailops.dto.EmployeeResponse;
import com.nforce.retailops.dto.UpdateEmployeeRequest;
import com.nforce.retailops.dto.UpdateEmployeeStatusRequest;
>>>>>>> Stashed changes
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.EmployeeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
<<<<<<< Updated upstream
import org.springframework.web.bind.annotation.*;
=======
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
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

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id
    ) {
        employeeService.deleteEmployee(principal.getUser().getId(), id);
        return ResponseEntity.noContent().build();
=======
    public ResponseEntity<List<EmployeeResponse>> listEmployees(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(employeeService.listEmployees(principal.getUser()));
    }

    @PostMapping
    public ResponseEntity<EmployeeResponse> createEmployee(
        @AuthenticationPrincipal AppUserDetails principal,
        @Valid @RequestBody CreateEmployeeRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(employeeService.createEmployee(principal.getUser(), request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<EmployeeResponse> updateEmployee(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id,
        @Valid @RequestBody UpdateEmployeeRequest request
    ) {
        return ResponseEntity.ok(employeeService.updateEmployee(principal.getUser(), id, request));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<EmployeeResponse> updateStatus(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id,
        @Valid @RequestBody UpdateEmployeeStatusRequest request
    ) {
        return ResponseEntity.ok(employeeService.updateStatus(principal.getUser(), id, request.active()));
>>>>>>> Stashed changes
    }
}
