package com.nforce.retailops.controller;

import com.nforce.retailops.dto.AddOwnerRequest;
import com.nforce.retailops.dto.AddOwnerResponse;
import com.nforce.retailops.dto.LoginRequest;
import com.nforce.retailops.dto.LoginResponse;
import com.nforce.retailops.service.OwnerProvisioningService;
import com.nforce.retailops.service.SuperAdminAuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class SuperAdminController {

    private final SuperAdminAuthService superAdminAuthService;
    private final OwnerProvisioningService ownerProvisioningService;

    public SuperAdminController(
        SuperAdminAuthService superAdminAuthService,
        OwnerProvisioningService ownerProvisioningService
    ) {
        this.superAdminAuthService = superAdminAuthService;
        this.ownerProvisioningService = ownerProvisioningService;
    }

    @PostMapping("/superlogin")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(superAdminAuthService.login(request.email(), request.password()));
    }

    @PostMapping("/addowners")
    public ResponseEntity<AddOwnerResponse> addOwner(@Valid @RequestBody AddOwnerRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ownerProvisioningService.addOwner(request));
    }
}
