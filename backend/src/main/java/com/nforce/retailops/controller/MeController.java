package com.nforce.retailops.controller;

import com.nforce.retailops.dto.MeResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.UserProfileService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
public class MeController {

    private final UserProfileService userProfileService;

    public MeController(UserProfileService userProfileService) {
        this.userProfileService = userProfileService;
    }

    @GetMapping
    public ResponseEntity<MeResponse> getMe(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(userProfileService.getMe(principal.getUser()));
    }
}
