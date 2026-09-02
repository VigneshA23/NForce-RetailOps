package com.nforce.retailops.controller;

import com.nforce.retailops.dto.ChecklistHistoryDetailResponse;
import com.nforce.retailops.dto.ChecklistHistorySummaryRow;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.ChecklistHistoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/checklist-history")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class ChecklistHistoryController {

    private final ChecklistHistoryService checklistHistoryService;

    public ChecklistHistoryController(ChecklistHistoryService checklistHistoryService) {
        this.checklistHistoryService = checklistHistoryService;
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

    @GetMapping("/detail")
    public ResponseEntity<ChecklistHistoryDetailResponse> detail(
        @AuthenticationPrincipal AppUserDetails principal,
        @RequestParam Long storeId,
        @RequestParam LocalDate date
    ) {
        return ResponseEntity.ok(checklistHistoryService.getDetail(
            principal.getUser().getId(), storeId, date));
    }
}
