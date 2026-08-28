package com.nforce.retailops.controller;

import com.nforce.retailops.dto.EmployeeChecklistCategoryResponse;
import com.nforce.retailops.dto.EmployeeStoreResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.EmployeeSelfService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/employee")
@PreAuthorize("hasRole('EMPLOYEE')")
public class EmployeeSelfController {

    private final EmployeeSelfService employeeSelfService;

    public EmployeeSelfController(EmployeeSelfService employeeSelfService) {
        this.employeeSelfService = employeeSelfService;
    }

    @GetMapping("/stores")
    public ResponseEntity<List<EmployeeStoreResponse>> myStores(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(employeeSelfService.listMyStores(principal.getUser().getId()));
    }

    @GetMapping("/tasks")
    public ResponseEntity<List<EmployeeChecklistCategoryResponse>> myChecklist(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam Long storeId
    ) {
        return ResponseEntity.ok(employeeSelfService.getChecklist(principal.getUser().getId(), storeId));
    }
}
