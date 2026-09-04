package com.nforce.retailops.controller;

import com.nforce.retailops.dto.IssueResponse;
import com.nforce.retailops.dto.RespondIssueRequest;
import com.nforce.retailops.entity.IssueStatus;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.IssueService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// Owner-facing: viewing and responding to issues employees raised for one of
// this owner's stores. Employee-facing raise/read-in-history lives on
// MeController instead, the same split every other owner-vs-employee feature
// in this app already uses.
@RestController
@RequestMapping("/api/stores/{storeId}/issues")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class IssueController {

    private final IssueService issueService;

    public IssueController(IssueService issueService) {
        this.issueService = issueService;
    }

    @GetMapping
    public ResponseEntity<List<IssueResponse>> list(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long storeId,
        @RequestParam(required = false) IssueStatus status
    ) {
        return ResponseEntity.ok(issueService.listForStore(principal.getUser().getId(), storeId, status));
    }

    @PostMapping("/{issueId}/respond")
    public ResponseEntity<IssueResponse> respond(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long storeId,
        @PathVariable Long issueId,
        @Valid @RequestBody RespondIssueRequest request
    ) {
        return ResponseEntity.ok(issueService.respondToIssue(principal.getUser().getId(), storeId, issueId, request));
    }
}
