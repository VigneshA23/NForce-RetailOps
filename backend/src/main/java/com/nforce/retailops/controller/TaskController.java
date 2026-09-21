package com.nforce.retailops.controller;

import com.nforce.retailops.dto.TaskRequest;
import com.nforce.retailops.dto.TaskResponse;
import com.nforce.retailops.dto.TaskStatusRequest;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@PreAuthorize("hasAnyRole('OWNER_ADMIN', 'SUPER_ADMIN')")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    // Shared by both roles: Owner Admin gets their own tasks, Super Admin gets
    // every task platform-wide (mirrors CategoryController.list()).
    @GetMapping
    public ResponseEntity<List<TaskResponse>> list(Authentication authentication) {
        if (authentication.getPrincipal() instanceof AppUserDetails appUserDetails) {
            return ResponseEntity.ok(taskService.listTasks(appUserDetails.getUser().getId()));
        }
        return ResponseEntity.ok(taskService.listTasksForSuperAdmin());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('OWNER_ADMIN')")
    public ResponseEntity<TaskResponse> get(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id
    ) {
        return ResponseEntity.ok(taskService.getTask(principal.getUser().getId(), id));
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER_ADMIN')")
    public ResponseEntity<TaskResponse> create(
        @AuthenticationPrincipal AppUserDetails principal,
        @Valid @RequestBody TaskRequest request
    ) {
        TaskResponse created = taskService.createTask(principal.getUser().getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // Super Admin's create: the store scope chosen in the frontend's wizard can
    // span stores under different owners, so this can return more than one
    // TaskResponse -- see TaskService.createTasksAsSuperAdmin.
    @PostMapping("/super-admin")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<TaskResponse>> createAsSuperAdmin(@Valid @RequestBody TaskRequest request) {
        List<TaskResponse> created = taskService.createTasksAsSuperAdmin(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER_ADMIN')")
    public ResponseEntity<TaskResponse> update(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id,
        @Valid @RequestBody TaskRequest request
    ) {
        return ResponseEntity.ok(taskService.updateTask(principal.getUser().getId(), id, request));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('OWNER_ADMIN')")
    public ResponseEntity<TaskResponse> updateStatus(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id,
        @Valid @RequestBody TaskStatusRequest request
    ) {
        return ResponseEntity.ok(taskService.setActive(principal.getUser().getId(), id, request.active()));
    }

    // Super Admin toggling any task's status regardless of which owner it
    // belongs to.
    @PatchMapping("/{id}/status/super-admin")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<TaskResponse> updateStatusAsSuperAdmin(
        @PathVariable Long id,
        @Valid @RequestBody TaskStatusRequest request
    ) {
        return ResponseEntity.ok(taskService.setActiveAsSuperAdmin(id, request.active()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER_ADMIN')")
    public ResponseEntity<Void> delete(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id
    ) {
        taskService.deleteTask(principal.getUser().getId(), id);
        return ResponseEntity.noContent().build();
    }

    // Super Admin deleting any task regardless of which owner it belongs to.
    @DeleteMapping("/{id}/super-admin")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> deleteAsSuperAdmin(@PathVariable Long id) {
        taskService.deleteTaskAsSuperAdmin(id);
        return ResponseEntity.noContent().build();
    }
}
