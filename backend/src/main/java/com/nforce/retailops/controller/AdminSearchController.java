package com.nforce.retailops.controller;

import com.nforce.retailops.dto.AdminSearchResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.AdminSearchService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class AdminSearchController {

    private final AdminSearchService searchService;

    public AdminSearchController(AdminSearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping("/search")
    public AdminSearchResponse search(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam(defaultValue = "") String q
    ) {
        return searchService.search(principal.getUser().getId(), q);
    }
}
