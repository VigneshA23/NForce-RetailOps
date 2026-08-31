package com.nforce.retailops.controller;

import com.nforce.retailops.dto.AssignedStoreResponse;
import com.nforce.retailops.dto.MeResponse;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.security.SuperAdminUserDetails;
import com.nforce.retailops.service.UserProfileService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/me")
public class MeController {

    private final UserProfileService userProfileService;

    public MeController(UserProfileService userProfileService) {
        this.userProfileService = userProfileService;
    }

    // Not role-gated, so the principal here can be either an AppUserDetails
    // (owner/employee) or a SuperAdminUserDetails -- they are separate
    // UserDetails implementations, not a hierarchy, so both must be handled.
    @GetMapping
    public ResponseEntity<MeResponse> getMe(@AuthenticationPrincipal UserDetails principal) {
        if (principal instanceof SuperAdminUserDetails superAdminDetails) {
            SuperAdmin superAdmin = superAdminDetails.getSuperAdmin();
            return ResponseEntity.ok(new MeResponse(
                superAdmin.getId(),
                superAdmin.getName(),
                superAdmin.getEmail(),
                "SUPER_ADMIN",
                List.of()
            ));
        }

        AppUserDetails userDetails = (AppUserDetails) principal;
        return ResponseEntity.ok(userProfileService.getMe(userDetails.getUser()));
    }

    @GetMapping("/stores")
    public ResponseEntity<List<AssignedStoreResponse>> myStores(
        @AuthenticationPrincipal UserDetails principal
    ) {
        if (principal instanceof SuperAdminUserDetails) {
            return ResponseEntity.ok(List.of());
        }

        AppUserDetails userDetails = (AppUserDetails) principal;
        return ResponseEntity.ok(userProfileService.listMyStores(userDetails.getUser()));
    }
}
