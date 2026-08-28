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
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@PreAuthorize("hasRole('OWNER_ADMIN')")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public ResponseEntity<List<TaskResponse>> list(@AuthenticationPrincipal AppUserDetails principal) {
        return ResponseEntity.ok(taskService.listTasks(principal.getUser().getId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TaskResponse> get(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id
    ) {
        return ResponseEntity.ok(taskService.getTask(principal.getUser().getId(), id));
    }

    @PostMapping
    public ResponseEntity<TaskResponse> create(
        @AuthenticationPrincipal AppUserDetails principal,
        @Valid @RequestBody TaskRequest request
    ) {
        TaskResponse created = taskService.createTask(principal.getUser().getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<TaskResponse> update(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id,
        @Valid @RequestBody TaskRequest request
    ) {
        return ResponseEntity.ok(taskService.updateTask(principal.getUser().getId(), id, request));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<TaskResponse> updateStatus(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id,
        @Valid @RequestBody TaskStatusRequest request
    ) {
        return ResponseEntity.ok(taskService.setActive(principal.getUser().getId(), id, request.active()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id
    ) {
        taskService.deleteTask(principal.getUser().getId(), id);
        return ResponseEntity.noContent().build();
    }
}
