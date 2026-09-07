package com.nforce.retailops.controller;

import com.nforce.retailops.dto.SASearchResponse;
import com.nforce.retailops.service.SuperAdminSearchService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/super-admin")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminSearchController {

    private final SuperAdminSearchService searchService;

    public SuperAdminSearchController(SuperAdminSearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping("/search")
    public SASearchResponse search(@RequestParam(defaultValue = "") String q) {
        return searchService.search(q);
    }
}
