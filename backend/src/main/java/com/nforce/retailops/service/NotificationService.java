package com.nforce.retailops.service;

import com.nforce.retailops.dto.NotificationResponse;
import com.nforce.retailops.entity.Notification;
import com.nforce.retailops.entity.NotificationCategory;
import com.nforce.retailops.entity.NotificationPriority;
import com.nforce.retailops.entity.RaisedIssue;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.NotificationNotFoundException;
import com.nforce.retailops.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> listForUser(Long userId) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId).stream()
            .map(NotificationResponse::from)
            .toList();
    }

    @Transactional
    public NotificationResponse markRead(Long userId, Long notificationId) {
        Notification notification = notificationRepository.findByIdAndRecipientId(notificationId, userId)
            .orElseThrow(() -> new NotificationNotFoundException("Notification not found"));
        notification.setRead(true);
        return NotificationResponse.from(notificationRepository.save(notification));
    }

    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.markAllReadForRecipient(userId);
    }

    // Only producer today: an owner's response to a RaisedIssue, notifying the
    // employee who raised it. Deliberately NOT @Transactional on its own -- it
    // always runs inside IssueService.respondToIssue's transaction, so the
    // notification and the issue's resolved state commit or roll back together.
    void notifyIssueResponse(RaisedIssue issue) {
        User employee = issue.getEmployee();
        String storeName = issue.getStore().getName();

        Notification notification = new Notification();
        notification.setRecipient(employee);
        notification.setTitle("Response to your issue at " + storeName);
        notification.setMessage(issue.getResponseText());
        notification.setCategory(NotificationCategory.ISSUE_RESPONSE);
        notification.setPriority(NotificationPriority.NORMAL);
        notification.setRelatedIssue(issue);
        notificationRepository.save(notification);
    }
}
