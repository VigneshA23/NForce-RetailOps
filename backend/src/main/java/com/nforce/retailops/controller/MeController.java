package com.nforce.retailops.controller;

import com.nforce.retailops.dto.AssignedStoreResponse;
import com.nforce.retailops.dto.ChecklistHistoryDetailResponse;
import com.nforce.retailops.dto.MeResponse;
import com.nforce.retailops.dto.TaskResponseStateResponse;
import com.nforce.retailops.dto.TaskResponseSubmitRequest;
import com.nforce.retailops.dto.TodayChecklistResponse;
import com.nforce.retailops.dto.UpdateMeRequest;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.security.SuperAdminUserDetails;
import com.nforce.retailops.service.MeHistoryService;
import com.nforce.retailops.service.TaskService;
import com.nforce.retailops.service.UserProfileService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/me")
public class MeController {

    private final UserProfileService userProfileService;
    private final TaskService taskService;
    private final MeHistoryService meHistoryService;

    public MeController(UserProfileService userProfileService, TaskService taskService, MeHistoryService meHistoryService) {
        this.userProfileService = userProfileService;
        this.taskService = taskService;
        this.meHistoryService = meHistoryService;
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
                List.of(),
                false,
                null,
                null,
                superAdmin.getPhone()
            ));
        }

        AppUserDetails userDetails = (AppUserDetails) principal;
        return ResponseEntity.ok(userProfileService.getMe(userDetails.getUser()));
    }

    // Self-service profile edit (name/email/phone) -- not available to super
    // admins, who have no User/StoreEmployee record for this service to update.
    @PutMapping
    public ResponseEntity<MeResponse> updateMe(
        @AuthenticationPrincipal UserDetails principal,
        @Valid @RequestBody UpdateMeRequest request
    ) {
        if (principal instanceof SuperAdminUserDetails) {
            throw new AccessDeniedException("Not supported for this account type");
        }

        AppUserDetails userDetails = (AppUserDetails) principal;
        return ResponseEntity.ok(userProfileService.updateMe(userDetails.getUser(), request));
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

    // Employee-facing: today's checklist for one of the caller's assigned stores,
    // grouped by category. requireAssignedStore (called inside TaskService) is what
    // actually enforces the store belongs to this employee -- an owner or an employee
    // not assigned to storeId both get masked as "store not found".
    @GetMapping("/tasks/today")
    public ResponseEntity<TodayChecklistResponse> todayChecklist(
        @AuthenticationPrincipal UserDetails principal,
        @RequestParam Long storeId
    ) {
        if (principal instanceof SuperAdminUserDetails) {
            throw new StoreNotFoundException("Store not found");
        }

        AppUserDetails userDetails = (AppUserDetails) principal;
        return ResponseEntity.ok(taskService.getTodayChecklistForEmployee(userDetails.getUser().getId(), storeId));
    }

    // Employee-facing: submit today's answer to one task. requireAssignedStore (called
    // inside TaskService) enforces the store belongs to this employee the same way the
    // checklist read does.
    @PostMapping("/tasks/{taskId}/responses")
    public ResponseEntity<TaskResponseStateResponse> submitTaskResponse(
        @AuthenticationPrincipal UserDetails principal,
        @PathVariable Long taskId,
        @Valid @RequestBody TaskResponseSubmitRequest request
    ) {
        if (principal instanceof SuperAdminUserDetails) {
            throw new StoreNotFoundException("Store not found");
        }

        AppUserDetails userDetails = (AppUserDetails) principal;
        return ResponseEntity.ok(taskService.submitResponse(userDetails.getUser().getId(), taskId, request));
    }

    // Employee-facing: undo a response. Only the employee who submitted it may undo it
    // (enforced in TaskService) -- the record is preserved, never hard-deleted.
    @PostMapping("/tasks/{taskId}/responses/{responseId}/undo")
    public ResponseEntity<TaskResponseStateResponse> undoTaskResponse(
        @AuthenticationPrincipal UserDetails principal,
        @PathVariable Long taskId,
        @PathVariable Long responseId,
        @RequestParam Long storeId
    ) {
        if (principal instanceof SuperAdminUserDetails) {
            throw new StoreNotFoundException("Store not found");
        }

        AppUserDetails userDetails = (AppUserDetails) principal;
        return ResponseEntity.ok(taskService.undoResponse(userDetails.getUser().getId(), taskId, storeId, responseId));
    }

    // Employee-facing: a single day's checklist history (categories -> tasks ->
    // responses) for one of the caller's assigned stores. requireAssignedStore
    // (called inside MeHistoryService) enforces the store belongs to this employee,
    // the same masked-as-"not found" pattern the other /me/tasks endpoints use.
    @GetMapping("/history/detail")
    public ResponseEntity<ChecklistHistoryDetailResponse> historyDetail(
        @AuthenticationPrincipal UserDetails principal,
        @RequestParam Long storeId,
        @RequestParam LocalDate date
    ) {
        if (principal instanceof SuperAdminUserDetails) {
            throw new StoreNotFoundException("Store not found");
        }

        AppUserDetails userDetails = (AppUserDetails) principal;
        return ResponseEntity.ok(meHistoryService.getDetail(userDetails.getUser().getId(), storeId, date));
    }
}
