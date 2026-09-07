package com.nforce.retailops.controller;

import com.nforce.retailops.dto.AssignedStoreResponse;
import com.nforce.retailops.dto.ChecklistHistoryDetailResponse;
import com.nforce.retailops.dto.EmployeeSearchResponse;
import com.nforce.retailops.dto.IssueResponse;
import com.nforce.retailops.dto.MeResponse;
import com.nforce.retailops.dto.RaiseIssueRequest;
import com.nforce.retailops.dto.TaskResponseStateResponse;
import com.nforce.retailops.dto.TaskResponseSubmitRequest;
import com.nforce.retailops.dto.TodayChecklistResponse;
import com.nforce.retailops.dto.UpdateAvatarRequest;
import com.nforce.retailops.dto.UpdateMeRequest;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.exception.EmailAlreadyExistsException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.SuperAdminRepository;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.security.SuperAdminUserDetails;
import com.nforce.retailops.service.EmployeeSearchService;
import com.nforce.retailops.service.MeHistoryService;
import com.nforce.retailops.service.RaisedIssueService;
import com.nforce.retailops.service.TaskService;
import com.nforce.retailops.service.UserProfileService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
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
    private final RaisedIssueService raisedIssueService;
    private final SuperAdminRepository superAdminRepository;
    private final EmployeeSearchService employeeSearchService;

    public MeController(UserProfileService userProfileService, TaskService taskService, MeHistoryService meHistoryService, RaisedIssueService raisedIssueService, SuperAdminRepository superAdminRepository, EmployeeSearchService employeeSearchService) {
        this.userProfileService = userProfileService;
        this.taskService = taskService;
        this.meHistoryService = meHistoryService;
        this.raisedIssueService = raisedIssueService;
        this.superAdminRepository = superAdminRepository;
        this.employeeSearchService = employeeSearchService;
    }

    private MeResponse superAdminMeResponse(SuperAdmin sa) {
        return new MeResponse(sa.getId(), sa.getName(), sa.getEmail(), "SUPER_ADMIN",
            List.of(), false, null, null, null, sa.getAvatarUrl());
    }

    // Not role-gated: principal is either AppUserDetails or SuperAdminUserDetails.
    @GetMapping
    public ResponseEntity<MeResponse> getMe(@AuthenticationPrincipal UserDetails principal) {
        if (principal instanceof SuperAdminUserDetails superAdminDetails) {
            return ResponseEntity.ok(superAdminMeResponse(superAdminDetails.getSuperAdmin()));
        }
        AppUserDetails userDetails = (AppUserDetails) principal;
        return ResponseEntity.ok(userProfileService.getMe(userDetails.getUser()));
    }

    // Self-service profile edit: name + email for all roles; phone only for employees.
    @Transactional
    @PutMapping
    public ResponseEntity<MeResponse> updateMe(
        @AuthenticationPrincipal UserDetails principal,
        @Valid @RequestBody UpdateMeRequest request
    ) {
        if (principal instanceof SuperAdminUserDetails superAdminDetails) {
            SuperAdmin sa = superAdminDetails.getSuperAdmin();
            String email = request.email().trim();
            if (!sa.getEmail().equalsIgnoreCase(email)) {
                superAdminRepository.findByEmailIgnoreCase(email)
                    .filter(existing -> !existing.getId().equals(sa.getId()))
                    .ifPresent(__ -> { throw new EmailAlreadyExistsException("A user with this email already exists"); });
            }
            sa.setName(request.fullName().trim());
            sa.setEmail(email);
            superAdminRepository.save(sa);
            return ResponseEntity.ok(superAdminMeResponse(sa));
        }
        AppUserDetails userDetails = (AppUserDetails) principal;
        return ResponseEntity.ok(userProfileService.updateMe(userDetails.getUser(), request));
    }

    // Avatar upload/removal — base64 data URL or null to clear.
    @Transactional
    @PatchMapping("/avatar")
    public ResponseEntity<Void> updateAvatar(
        @AuthenticationPrincipal UserDetails principal,
        @RequestBody UpdateAvatarRequest request
    ) {
        if (principal instanceof SuperAdminUserDetails superAdminDetails) {
            SuperAdmin sa = superAdminDetails.getSuperAdmin();
            sa.setAvatarUrl(request.avatarUrl());
            superAdminRepository.save(sa);
            return ResponseEntity.noContent().build();
        }
        AppUserDetails userDetails = (AppUserDetails) principal;
        userProfileService.updateAvatar(userDetails.getUser(), request.avatarUrl());
        return ResponseEntity.noContent().build();
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

    // Employee-facing: list issues raised by this employee for one of their stores.
    @GetMapping("/issues")
    public ResponseEntity<List<IssueResponse>> myIssues(
        @AuthenticationPrincipal UserDetails principal,
        @RequestParam Long storeId
    ) {
        if (principal instanceof SuperAdminUserDetails) {
            throw new StoreNotFoundException("Store not found");
        }
        AppUserDetails userDetails = (AppUserDetails) principal;
        return ResponseEntity.ok(raisedIssueService.listForEmployee(userDetails.getUser().getId(), storeId));
    }

    // Employee-facing: raise a store issue to the owner.
    // requireAssignedStore (called inside RaisedIssueService) ensures the
    // employee is actually assigned to the given store.
    @PostMapping("/issues")
    public ResponseEntity<IssueResponse> raiseIssue(
        @AuthenticationPrincipal UserDetails principal,
        @Valid @RequestBody RaiseIssueRequest request
    ) {
        if (principal instanceof SuperAdminUserDetails) {
            throw new StoreNotFoundException("Store not found");
        }
        AppUserDetails userDetails = (AppUserDetails) principal;
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED)
            .body(raisedIssueService.createIssue(userDetails.getUser().getId(), request));
    }

    // Employee-facing: lightweight search across today's tasks and raised issues,
    // scoped to the caller's assigned store. Returns up to 5 results per group.
    @GetMapping("/search")
    public ResponseEntity<EmployeeSearchResponse> search(
        @AuthenticationPrincipal UserDetails principal,
        @RequestParam Long storeId,
        @RequestParam String q
    ) {
        if (principal instanceof SuperAdminUserDetails) {
            return ResponseEntity.ok(new EmployeeSearchResponse(List.of(), List.of()));
        }
        AppUserDetails userDetails = (AppUserDetails) principal;
        return ResponseEntity.ok(employeeSearchService.search(userDetails.getUser(), storeId, q));
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
