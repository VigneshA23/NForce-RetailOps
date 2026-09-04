package com.nforce.retailops.service;

import com.nforce.retailops.dto.NotificationResponse;
import com.nforce.retailops.entity.IssueStatus;
import com.nforce.retailops.entity.Notification;
import com.nforce.retailops.entity.NotificationCategory;
import com.nforce.retailops.entity.RaisedIssue;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.NotificationNotFoundException;
import com.nforce.retailops.repository.NotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    private static final Long USER_ID = 42L;
    private static final Long NOTIFICATION_ID = 5L;

    @Mock
    private NotificationRepository notificationRepository;

    @InjectMocks
    private NotificationService notificationService;

    private User employee;
    private Store store;

    @BeforeEach
    void setUp() {
        employee = new User();
        ReflectionTestUtils.setField(employee, "id", USER_ID);

        store = new Store();
        ReflectionTestUtils.setField(store, "id", 1L);
        store.setName("Downtown Store");
    }

    @Test
    void markReadRejectsANotificationThatDoesNotBelongToTheCaller() {
        when(notificationRepository.findByIdAndRecipientId(NOTIFICATION_ID, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> notificationService.markRead(USER_ID, NOTIFICATION_ID))
            .isInstanceOf(NotificationNotFoundException.class);
    }

    @Test
    void markReadFlipsTheFlagAndPersistsIt() {
        Notification notification = new Notification();
        ReflectionTestUtils.setField(notification, "id", NOTIFICATION_ID);
        notification.setRecipient(employee);
        notification.setCategory(NotificationCategory.ISSUE_RESPONSE);
        notification.setRead(false);
        when(notificationRepository.findByIdAndRecipientId(NOTIFICATION_ID, USER_ID)).thenReturn(Optional.of(notification));
        when(notificationRepository.save(notification)).thenReturn(notification);

        NotificationResponse response = notificationService.markRead(USER_ID, NOTIFICATION_ID);

        assertThat(response.read()).isTrue();
        assertThat(notification.isRead()).isTrue();
    }

    @Test
    void markAllReadDelegatesToTheBulkRepositoryUpdate() {
        notificationService.markAllRead(USER_ID);

        verify(notificationRepository).markAllReadForRecipient(USER_ID);
    }

    // Proves the Admin-response -> Employee-notification link: responding to an
    // issue creates a notification addressed to the employee who raised it,
    // not the responding owner, carrying the response text as its message.
    @Test
    void notifyIssueResponseCreatesANotificationForTheRaisingEmployee() {
        RaisedIssue issue = new RaisedIssue();
        ReflectionTestUtils.setField(issue, "id", 9L);
        issue.setStore(store);
        issue.setEmployee(employee);
        issue.setNote("Ice machine is broken.");
        issue.setStatus(IssueStatus.RESOLVED);
        issue.setResponseText("A technician is on the way.");

        notificationService.notifyIssueResponse(issue);

        ArgumentCaptor<Notification> saved = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(saved.capture());
        Notification notification = saved.getValue();
        assertThat(notification.getRecipient()).isEqualTo(employee);
        assertThat(notification.getMessage()).isEqualTo("A technician is on the way.");
        assertThat(notification.getCategory()).isEqualTo(NotificationCategory.ISSUE_RESPONSE);
        assertThat(notification.getRelatedIssue()).isEqualTo(issue);
        assertThat(notification.isRead()).isFalse();
    }
}
