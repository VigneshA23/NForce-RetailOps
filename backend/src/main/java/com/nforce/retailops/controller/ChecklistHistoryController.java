package com.nforce.retailops.controller;

import com.nforce.retailops.dto.AdminCorrectionApplyResponse;
import com.nforce.retailops.dto.AdminCorrectionEntry;
import com.nforce.retailops.dto.AdminCorrectionRequest;
import com.nforce.retailops.dto.ChecklistHistoryDetailResponse;
import com.nforce.retailops.dto.ChecklistHistoryOperationsReportResponse;
import com.nforce.retailops.dto.ChecklistHistorySummaryRow;
import com.nforce.retailops.dto.FlagResponseRequest;
import com.nforce.retailops.dto.HistoryResponseEntryResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.security.SuperAdminUserDetails;
import com.nforce.retailops.service.AdminCorrectionService;
import com.nforce.retailops.service.ChecklistHistoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/checklist-history")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class ChecklistHistoryController {

    private final ChecklistHistoryService checklistHistoryService;
    private final AdminCorrectionService adminCorrectionService;

    public ChecklistHistoryController(
        ChecklistHistoryService checklistHistoryService,
        AdminCorrectionService adminCorrectionService
    ) {
        this.checklistHistoryService = checklistHistoryService;
        this.adminCorrectionService = adminCorrectionService;
    }

    // storeIds omitted -> all stores this owner has; startDate/endDate omitted -> today.
    @GetMapping("/summary")
    public ResponseEntity<List<ChecklistHistorySummaryRow>> summary(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam(required = false) List<Long> storeIds,
        @RequestParam(required = false) LocalDate startDate,
        @RequestParam(required = false) LocalDate endDate
    ) {
        return ResponseEntity.ok(checklistHistoryService.getSummary(
            principal.getUser().getId(), storeIds, startDate, endDate));
    }

    // Daily Operations Summary report -- deliberately has no storeId/storeIds param
    // at all: the backend always resolves the caller's own authorized store(s), so
    // an Owner/Admin can never request another store's summary or task details.
    @GetMapping("/operations-summary")
    public ResponseEntity<ChecklistHistoryOperationsReportResponse> operationsSummary(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam(required = false) LocalDate startDate,
        @RequestParam(required = false) LocalDate endDate
    ) {
        return ResponseEntity.ok(checklistHistoryService.getOperationsReport(
            principal.getUser().getId(), startDate, endDate));
    }

    @PatchMapping("/responses/{responseId}/correct")
    @PreAuthorize("hasAnyRole('OWNER_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<AdminCorrectionApplyResponse> correctResponse(
        Authentication authentication,
        @PathVariable Long responseId,
        @RequestBody AdminCorrectionRequest request
    ) {
        Long adminUserId = null;
        String adminDisplayName = null;
        if (authentication.getPrincipal() instanceof AppUserDetails appUserDetails) {
            adminUserId = appUserDetails.getUser().getId();
        } else if (authentication.getPrincipal() instanceof SuperAdminUserDetails superAdminDetails) {
            adminDisplayName = superAdminDetails.getSuperAdmin().getName();
        }
        return ResponseEntity.ok(
            adminCorrectionService.correctResponse(responseId, adminUserId, adminDisplayName, request));
    }

    @PostMapping("/responses/{responseId}/flag")
    @PreAuthorize("hasAnyRole('OWNER_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<HistoryResponseEntryResponse> flagResponse(
        Authentication authentication,
        @PathVariable Long responseId,
        @RequestBody FlagResponseRequest request
    ) {
        Long adminUserId = null;
        String adminDisplayName = null;
        if (authentication.getPrincipal() instanceof AppUserDetails appUserDetails) {
            adminUserId = appUserDetails.getUser().getId();
        } else if (authentication.getPrincipal() instanceof SuperAdminUserDetails superAdminDetails) {
            adminDisplayName = superAdminDetails.getSuperAdmin().getName();
        }
        return ResponseEntity.ok(
            adminCorrectionService.flagResponse(responseId, adminUserId, adminDisplayName, request.reason()));
    }

    @GetMapping("/responses/{responseId}/corrections")
    @PreAuthorize("hasAnyRole('OWNER_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<List<AdminCorrectionEntry>> correctionHistory(
        Authentication authentication,
        @PathVariable Long responseId
    ) {
        Long adminUserId = null;
        if (authentication.getPrincipal() instanceof AppUserDetails appUserDetails) {
            adminUserId = appUserDetails.getUser().getId();
        }
        return ResponseEntity.ok(
            adminCorrectionService.getCorrectionHistory(responseId, adminUserId));
    }

    // Super Admin can view any store's checklist by looking up the store's actual owner.
    // Uses Authentication (not @AuthenticationPrincipal AppUserDetails) because Super Admin
    // uses SuperAdminUserDetails — a different principal type — and @AuthenticationPrincipal
    // with a typed parameter binds to null when the type doesn't match.
    @GetMapping("/detail")
    @PreAuthorize("hasAnyRole('OWNER_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ChecklistHistoryDetailResponse> detail(
        Authentication authentication,
        @RequestParam Long storeId,
        @RequestParam LocalDate date
    ) {
        ChecklistHistoryDetailResponse response =
            authentication.getPrincipal() instanceof AppUserDetails appUserDetails
                ? checklistHistoryService.getDetail(appUserDetails.getUser().getId(), storeId, date)
                : checklistHistoryService.getDetailForSuperAdmin(storeId, date);
        return ResponseEntity.ok(response);
    }
}
