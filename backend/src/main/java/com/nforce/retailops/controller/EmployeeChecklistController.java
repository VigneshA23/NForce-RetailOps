package com.nforce.retailops.controller;

import com.nforce.retailops.dto.EmployeeChecklistCategoryResponse;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.TaskService;
import com.nforce.retailops.service.UserProfileService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/stores/{storeId}/checklist")
@PreAuthorize("hasRole('EMPLOYEE')")
public class EmployeeChecklistController {

    private final UserProfileService userProfileService;
    private final StoreOwnerRepository storeOwnerRepository;
    private final TaskService taskService;

    public EmployeeChecklistController(
        UserProfileService userProfileService,
        StoreOwnerRepository storeOwnerRepository,
        TaskService taskService
    ) {
        this.userProfileService = userProfileService;
        this.storeOwnerRepository = storeOwnerRepository;
        this.taskService = taskService;
    }

    @GetMapping
    public ResponseEntity<List<EmployeeChecklistCategoryResponse>> getChecklist(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long storeId
    ) {
        userProfileService.requireAssignedStore(principal.getUser().getId(), storeId);
        StoreOwner storeOwner = storeOwnerRepository.findByStoreId(storeId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
        return ResponseEntity.ok(taskService.getEmployeeChecklist(storeOwner.getOwner().getId(), storeId));
    }
}
