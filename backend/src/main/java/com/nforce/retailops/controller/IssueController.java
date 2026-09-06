package com.nforce.retailops.controller;

import com.nforce.retailops.dto.IssueResponse;
import com.nforce.retailops.dto.UpdateIssueStatusRequest;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.RaisedIssueService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/issues")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class IssueController {

    private final RaisedIssueService raisedIssueService;

    public IssueController(RaisedIssueService raisedIssueService) {
        this.raisedIssueService = raisedIssueService;
    }

    @GetMapping
    public ResponseEntity<List<IssueResponse>> listIssues(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam Long storeId,
        @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(raisedIssueService.listForOwner(principal.getUser().getId(), storeId, status));
    }

    @PatchMapping("/{issueId}/status")
    public ResponseEntity<IssueResponse> updateStatus(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long issueId,
        @Valid @RequestBody UpdateIssueStatusRequest request
    ) {
        return ResponseEntity.ok(raisedIssueService.updateStatus(issueId, principal.getUser().getId(), request));
    }
}
