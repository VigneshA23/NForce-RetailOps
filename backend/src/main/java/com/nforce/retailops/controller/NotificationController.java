package com.nforce.retailops.controller;

import com.nforce.retailops.dto.NotificationResponse;
import com.nforce.retailops.security.AppUserDetails;
import com.nforce.retailops.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@PreAuthorize("hasAnyRole('OWNER_ADMIN', 'EMPLOYEE')")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<List<NotificationResponse>> list(
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return ResponseEntity.ok(notificationService.list(principal.getUser().getId()));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> unreadCount(
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        return ResponseEntity.ok(notificationService.unreadCount(principal.getUser().getId()));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<NotificationResponse> markRead(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id
    ) {
        return ResponseEntity.ok(notificationService.markRead(id, principal.getUser().getId()));
    }

    @PatchMapping("/mark-all-read")
    public ResponseEntity<Void> markAllRead(
        @AuthenticationPrincipal AppUserDetails principal
    ) {
        notificationService.markAllRead(principal.getUser().getId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
        @AuthenticationPrincipal AppUserDetails principal,
        @PathVariable Long id
    ) {
        notificationService.delete(id, principal.getUser().getId());
        return ResponseEntity.noContent().build();
    }
}
