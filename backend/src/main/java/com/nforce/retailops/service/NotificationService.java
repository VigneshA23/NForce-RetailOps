package com.nforce.retailops.service;

import com.nforce.retailops.dto.NotificationResponse;
import com.nforce.retailops.entity.AdminCorrection;
import com.nforce.retailops.entity.Notification;
import com.nforce.retailops.entity.RaisedIssue;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.IssueNotFoundException;
import com.nforce.retailops.repository.NotificationRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class NotificationService {

    private static final int MAX_NOTIFICATIONS = 100;

    private static final Map<String, String> PRIORITY_BY_CATEGORY;
    static {
        PRIORITY_BY_CATEGORY = new HashMap<>();
        PRIORITY_BY_CATEGORY.put("ISSUE_RAISED",                  "HIGH");
        PRIORITY_BY_CATEGORY.put("ISSUE_RESOLVED",               "HIGH");
        PRIORITY_BY_CATEGORY.put("ISSUE_ACKNOWLEDGED",           "MEDIUM");
        PRIORITY_BY_CATEGORY.put("STORE_DEACTIVATED",             "HIGH");
        PRIORITY_BY_CATEGORY.put("ACCOUNT_DEACTIVATED",           "HIGH");
        PRIORITY_BY_CATEGORY.put("EMPLOYEE_ACCOUNT_DEACTIVATED",  "HIGH");
        PRIORITY_BY_CATEGORY.put("EMPLOYEE_REMOVED",              "HIGH");
        PRIORITY_BY_CATEGORY.put("CORRECTION_MADE",               "MEDIUM");
        PRIORITY_BY_CATEGORY.put("STORE_REACTIVATED",             "MEDIUM");
        PRIORITY_BY_CATEGORY.put("ACCOUNT_REACTIVATED",           "MEDIUM");
        PRIORITY_BY_CATEGORY.put("EMPLOYEE_ACCOUNT_REACTIVATED",  "MEDIUM");
        PRIORITY_BY_CATEGORY.put("TASK_ADDED",                    "LOW");
        PRIORITY_BY_CATEGORY.put("CATEGORY_ADDED",                "LOW");
        PRIORITY_BY_CATEGORY.put("EMPLOYEE_ASSIGNED",             "LOW");
        PRIORITY_BY_CATEGORY.put("NEW_EMPLOYEE_JOINED",           "LOW");
        // Super Admin categories
        PRIORITY_BY_CATEGORY.put("STORE_ZERO_ACTIVITY",           "HIGH");
        PRIORITY_BY_CATEGORY.put("OWNER_EMAIL_FAILED",            "HIGH");
        PRIORITY_BY_CATEGORY.put("ISSUES_OVERDUE",                "MEDIUM");
    }

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    // Generic notification creation — the single entry point for all new notification types.
    // Priority is resolved automatically from the category; callers do not need to set it.
    @Transactional
    public void send(User recipient, String category, String title, String message, String linkPath) {
        Notification n = new Notification();
        n.setRecipientUser(recipient);
        n.setCategory(category);
        n.setTitle(title);
        n.setMessage(message);
        n.setLinkPath(linkPath);
        n.setPriority(PRIORITY_BY_CATEGORY.getOrDefault(category, "MEDIUM"));
        notificationRepository.save(n);
    }

    // Super Admin targeted notification — separate from user notifications because
    // Super Admins have their own identity table and are not in the users table.
    @Transactional
    public void sendToSuperAdmin(SuperAdmin recipient, String category, String title, String message, String linkPath, String dedupKey) {
        Notification n = new Notification();
        n.setRecipientSuperAdmin(recipient);
        n.setCategory(category);
        n.setTitle(title);
        n.setMessage(message);
        n.setLinkPath(linkPath);
        n.setDedupKey(dedupKey);
        n.setPriority(PRIORITY_BY_CATEGORY.getOrDefault(category, "MEDIUM"));
        notificationRepository.save(n);
    }

    @Transactional(readOnly = true)
    public boolean superAdminNotificationExists(Long superAdminId, String dedupKey) {
        return notificationRepository.existsByRecipientSuperAdminIdAndDedupKey(superAdminId, dedupKey);
    }

    // ISSUE_RAISED kept separate: sets the relatedIssue FK used by the detail
    // panel in the Notifications page. All other categories go through send().
    @Transactional
    public void createForIssue(RaisedIssue issue, User owner) {
        String employeeName = issue.getEmployeeUser().getFullName();
        String storeName = issue.getStore().getName();
        String notePreview = issue.getNote().length() > 80
            ? issue.getNote().substring(0, 80) + "…"
            : issue.getNote();

        Notification n = new Notification();
        n.setRecipientUser(owner);
        n.setCategory("ISSUE_RAISED");
        n.setPriority("HIGH");
        n.setTitle(employeeName + " raised an issue at " + storeName);
        n.setMessage(notePreview);
        n.setRelatedIssue(issue);
        notificationRepository.save(n);
    }

    // Notifies the employee who raised the issue when the admin acknowledges or resolves it.
    // Scoped to the single reporter — never fan-out to all store employees.
    @Transactional
    public void createForIssueUpdate(RaisedIssue issue, String newStatus) {
        User employee = issue.getEmployeeUser();
        String storeName = issue.getStore().getName();
        String notePreview = issue.getNote().length() > 60
            ? issue.getNote().substring(0, 60) + "…"
            : issue.getNote();

        if ("ACKNOWLEDGED".equals(newStatus)) {
            send(employee, "ISSUE_ACKNOWLEDGED",
                "Your issue at " + storeName + " was acknowledged",
                "The admin has seen your issue: \"" + notePreview + "\"",
                null);
        } else if ("RESOLVED".equals(newStatus)) {
            String responseText = issue.getResponseText();
            String msg = (responseText != null && !responseText.isBlank())
                ? "Response: " + responseText
                : "The admin has resolved your issue: \"" + notePreview + "\"";
            send(employee, "ISSUE_RESOLVED",
                "Your issue at " + storeName + " has been resolved",
                msg,
                null);
        }
    }

    @Transactional
    public void createForCorrection(AdminCorrection correction) {
        User employee = correction.getTaskResponse().getEmployee();
        String taskName = correction.getTaskResponse().getTask().getName();
        String reason = correction.getReason();
        send(employee, "CORRECTION_MADE",
            "Your \"" + taskName + "\" response was corrected",
            reason != null && !reason.isBlank()
                ? "Reason: " + reason
                : "Your response was reviewed and corrected by the store admin.",
            "/audit");
    }

    @Transactional
    public void createForStoreStatus(Store store, User owner, boolean active) {
        send(owner,
            active ? "STORE_REACTIVATED" : "STORE_DEACTIVATED",
            store.getName() + (active ? " has been reactivated" : " has been deactivated"),
            active
                ? "Your store has been reactivated by a Super Admin. You can now access it."
                : "Your store has been deactivated by a Super Admin.",
            active ? "/home" : null);
    }

    @Transactional
    public void createForAccountStatus(User owner, boolean active) {
        send(owner,
            active ? "ACCOUNT_REACTIVATED" : "ACCOUNT_DEACTIVATED",
            active ? "Your account has been reactivated" : "Your account has been deactivated",
            active
                ? "Your NForce account has been reactivated by a Super Admin."
                : "Your NForce account has been deactivated by a Super Admin.",
            active ? "/home" : null);
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> list(Long userId) {
        return notificationRepository
            .findByRecipientUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, MAX_NOTIFICATIONS))
            .stream()
            .map(NotificationResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Long> unreadCount(Long userId) {
        return Map.of("count", notificationRepository.countByRecipientUserIdAndReadFalse(userId));
    }

    @Transactional
    public NotificationResponse markRead(Long notificationId, Long userId) {
        Notification n = notificationRepository.findByIdAndRecipientUserId(notificationId, userId)
            .orElseThrow(() -> new IssueNotFoundException("Notification not found"));
        n.setRead(true);
        return NotificationResponse.from(notificationRepository.save(n));
    }

    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.markAllReadByRecipientUserId(userId);
    }

    @Transactional
    public void delete(Long notificationId, Long userId) {
        Notification n = notificationRepository.findByIdAndRecipientUserId(notificationId, userId)
            .orElseThrow(() -> new IssueNotFoundException("Notification not found"));
        notificationRepository.delete(n);
    }

    // Super Admin variants of the same read/list operations
    @Transactional(readOnly = true)
    public List<NotificationResponse> listForSuperAdmin(Long superAdminId) {
        return notificationRepository
            .findByRecipientSuperAdminIdOrderByCreatedAtDesc(superAdminId, PageRequest.of(0, MAX_NOTIFICATIONS))
            .stream()
            .map(NotificationResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Long> unreadCountForSuperAdmin(Long superAdminId) {
        return Map.of("count", notificationRepository.countByRecipientSuperAdminIdAndReadFalse(superAdminId));
    }

    @Transactional
    public NotificationResponse markReadForSuperAdmin(Long notificationId, Long superAdminId) {
        Notification n = notificationRepository.findByIdAndRecipientSuperAdminId(notificationId, superAdminId)
            .orElseThrow(() -> new IssueNotFoundException("Notification not found"));
        n.setRead(true);
        return NotificationResponse.from(notificationRepository.save(n));
    }

    @Transactional
    public void markAllReadForSuperAdmin(Long superAdminId) {
        notificationRepository.markAllReadByRecipientSuperAdminId(superAdminId);
    }

    @Transactional
    public void deleteForSuperAdmin(Long notificationId, Long superAdminId) {
        Notification n = notificationRepository.findByIdAndRecipientSuperAdminId(notificationId, superAdminId)
            .orElseThrow(() -> new IssueNotFoundException("Notification not found"));
        notificationRepository.delete(n);
    }
}
