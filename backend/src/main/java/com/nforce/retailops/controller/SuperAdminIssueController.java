package com.nforce.retailops.controller;

import com.nforce.retailops.dto.IssueResponse;
import com.nforce.retailops.dto.UpdateIssueStatusRequest;
import com.nforce.retailops.service.RaisedIssueService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/issues")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminIssueController {

    private final RaisedIssueService raisedIssueService;

    public SuperAdminIssueController(RaisedIssueService raisedIssueService) {
        this.raisedIssueService = raisedIssueService;
    }

    @GetMapping
    public ResponseEntity<List<IssueResponse>> listAllIssues(
        @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(raisedIssueService.listAllForSuperAdmin(status));
    }

    @PatchMapping("/{issueId}/status")
    public ResponseEntity<IssueResponse> updateStatus(
        @PathVariable Long issueId,
        @Valid @RequestBody UpdateIssueStatusRequest request
    ) {
        return ResponseEntity.ok(raisedIssueService.updateStatusForSuperAdmin(issueId, request));
    }

    @PostMapping("/{issueId}/nudge")
    public ResponseEntity<Void> nudgeOwner(@PathVariable Long issueId) {
        raisedIssueService.nudgeOwner(issueId);
        return ResponseEntity.noContent().build();
    }
}
