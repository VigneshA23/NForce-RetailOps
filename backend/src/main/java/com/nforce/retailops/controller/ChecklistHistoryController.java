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

    // storeIds omitted -> all stores the caller can see (an Owner/Admin's own
    // store(s); every actively-owned store on the platform for Super Admin);
    // startDate/endDate omitted -> today. Uses Authentication (not
    // @AuthenticationPrincipal AppUserDetails), same reason as /detail: a Super
    // Admin's principal is SuperAdminUserDetails, which a typed AppUserDetails
    // parameter would silently bind to null instead of matching.
    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('OWNER_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<List<ChecklistHistorySummaryRow>> summary(
        Authentication authentication,
        @RequestParam(required = false) List<Long> storeIds,
        @RequestParam(required = false) LocalDate startDate,
        @RequestParam(required = false) LocalDate endDate
    ) {
        List<ChecklistHistorySummaryRow> response =
            authentication.getPrincipal() instanceof AppUserDetails appUserDetails
                ? checklistHistoryService.getSummary(appUserDetails.getUser().getId(), storeIds, startDate, endDate)
                : checklistHistoryService.getSummaryForSuperAdmin(storeIds, startDate, endDate);
        return ResponseEntity.ok(response);
    }

    // Daily Operations Summary report. For an Owner/Admin, storeId is ignored and the
    // backend always resolves the caller's own authorized store(s) -- an Owner/Admin
    // can never request another store's summary or task details. Super Admin has no
    // "own stores," so storeId is required for that caller and resolved the same way
    // /detail does (uses Authentication, not @AuthenticationPrincipal AppUserDetails,
    // since a Super Admin's principal is SuperAdminUserDetails).
    @GetMapping("/operations-summary")
    @PreAuthorize("hasAnyRole('OWNER_ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ChecklistHistoryOperationsReportResponse> operationsSummary(
        Authentication authentication,
        @RequestParam(required = false) Long storeId,
        @RequestParam(required = false) LocalDate startDate,
        @RequestParam(required = false) LocalDate endDate
    ) {
        ChecklistHistoryOperationsReportResponse response =
            authentication.getPrincipal() instanceof AppUserDetails appUserDetails
                ? checklistHistoryService.getOperationsReport(appUserDetails.getUser().getId(), startDate, endDate)
                : checklistHistoryService.getOperationsReportForSuperAdmin(storeId, startDate, endDate);
        return ResponseEntity.ok(response);
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
