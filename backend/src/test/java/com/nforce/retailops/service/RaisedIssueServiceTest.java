package com.nforce.retailops.service;

import com.nforce.retailops.dto.IssueResponse;
import com.nforce.retailops.dto.RaiseIssueRequest;
import com.nforce.retailops.dto.UpdateIssueStatusRequest;
import com.nforce.retailops.entity.RaisedIssue;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.SuperAdmin;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.InvalidIssueTransitionException;
import com.nforce.retailops.exception.IssueAlreadyResolvedException;
import com.nforce.retailops.exception.IssueNotFoundException;
import com.nforce.retailops.exception.NudgeCooldownException;
import com.nforce.retailops.exception.StoreHasNoActiveOwnerException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.RaisedIssueRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

// Proves the core of the "Raise with Owner" -> Admin response -> Employee
// notification pipeline at the service layer: an owner can only update status
// on issues belonging to their stores, and a successful RESOLVED transition
// both updates the issue and fires createForIssueUpdate (NotificationService).
@ExtendWith(MockitoExtension.class)
class RaisedIssueServiceTest {

    private static final Long OWNER_ID = 1L;
    private static final Long STORE_ID = 10L;
    private static final Long EMPLOYEE_ID = 42L;
    private static final Long ISSUE_ID = 7L;

    @Mock private RaisedIssueRepository raisedIssueRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private UserRepository userRepository;
    @Mock private StoreOwnerRepository storeOwnerRepository;
    @Mock private UserProfileService userProfileService;
    @Mock private NotificationService notificationService;
    @Mock private ActivityLogService activityLogService;

    @InjectMocks
    private RaisedIssueService raisedIssueService;

    private Store store;
    private User employee;
    private User owner;
    private RaisedIssue issue;

    @BeforeEach
    void setUp() {
        store = new Store();
        ReflectionTestUtils.setField(store, "id", STORE_ID);
        store.setName("Downtown Store");

        employee = new User();
        ReflectionTestUtils.setField(employee, "id", EMPLOYEE_ID);
        employee.setFullName("Jane Doe");

        owner = new User();
        ReflectionTestUtils.setField(owner, "id", OWNER_ID);
        owner.setFullName("Store Owner");

        issue = new RaisedIssue();
        ReflectionTestUtils.setField(issue, "id", ISSUE_ID);
        issue.setStore(store);
        issue.setEmployeeUser(employee);
        issue.setNote("The ice cream machine is broken.");
    }

    @Test
    void raisingAnIssuePersistsItAgainstTheEmployeesAssignedStore() {
        when(storeRepository.findById(STORE_ID)).thenReturn(Optional.of(store));
        when(userRepository.findById(EMPLOYEE_ID)).thenReturn(Optional.of(employee));
        when(raisedIssueRepository.save(any(RaisedIssue.class))).thenAnswer(i -> i.getArgument(0));
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(STORE_ID)).thenReturn(Optional.empty());

        IssueResponse response = raisedIssueService.createIssue(EMPLOYEE_ID, new RaiseIssueRequest(STORE_ID, "  Freezer is loud.  "));

        verify(userProfileService).requireAssignedStore(EMPLOYEE_ID, STORE_ID);
        assertThat(response.note()).isEqualTo("Freezer is loud.");
        assertThat(response.status()).isEqualTo("OPEN");
        assertThat(response.storeId()).isEqualTo(STORE_ID);
    }

    @Test
    void resolvingAnIssueResolvesItAndNotifiesViaCreateForIssueUpdate() {
        when(raisedIssueRepository.findByIdWithEmployee(ISSUE_ID)).thenReturn(Optional.of(issue));
        when(storeOwnerRepository.findByStoreIdAndOwnerIdAndActiveTrue(STORE_ID, OWNER_ID))
            .thenReturn(Optional.of(new StoreOwner()));
        when(userRepository.findById(OWNER_ID)).thenReturn(Optional.of(owner));
        when(raisedIssueRepository.save(any(RaisedIssue.class))).thenAnswer(i -> i.getArgument(0));

        IssueResponse response = raisedIssueService.updateStatus(
            ISSUE_ID, OWNER_ID, new UpdateIssueStatusRequest("RESOLVED", "We've scheduled a repair for tomorrow.")
        );

        assertThat(response.status()).isEqualTo("RESOLVED");
        assertThat(response.responseText()).isEqualTo("We've scheduled a repair for tomorrow.");
        assertThat(issue.getRespondedByUser()).isEqualTo(owner);
        assertThat(issue.getRespondedAt()).isNotNull();

        ArgumentCaptor<RaisedIssue> notified = ArgumentCaptor.forClass(RaisedIssue.class);
        verify(notificationService).createForIssueUpdate(notified.capture(), eq("RESOLVED"));
        assertThat(notified.getValue().getEmployeeUser()).isEqualTo(employee);
        assertThat(notified.getValue().getResponseText()).isEqualTo("We've scheduled a repair for tomorrow.");
    }

    @Test
    void updatingStatusAsAnOwnerWhoDoesNotOwnTheStoreIsRejected() {
        when(raisedIssueRepository.findByIdWithEmployee(ISSUE_ID)).thenReturn(Optional.of(issue));
        when(storeOwnerRepository.findByStoreIdAndOwnerIdAndActiveTrue(STORE_ID, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
            raisedIssueService.updateStatus(ISSUE_ID, OWNER_ID, new UpdateIssueStatusRequest("RESOLVED", "Nope."))
        ).isInstanceOf(AccessDeniedException.class);

        verify(raisedIssueRepository, never()).save(any());
        verify(notificationService, never()).createForIssueUpdate(any(), any());
    }

    @Test
    void updatingStatusForAnIssueThatDoesNotExistIsNotFound() {
        when(raisedIssueRepository.findByIdWithEmployee(ISSUE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
            raisedIssueService.updateStatus(ISSUE_ID, OWNER_ID, new UpdateIssueStatusRequest("RESOLVED", "Nope."))
        ).isInstanceOf(IssueNotFoundException.class);

        verify(notificationService, never()).createForIssueUpdate(any(), any());
    }

    // ── Status transitions ────────────────────────────────────────────────────

    private void ownerOwnsStore() {
        when(raisedIssueRepository.findByIdWithEmployee(ISSUE_ID)).thenReturn(Optional.of(issue));
        when(storeOwnerRepository.findByStoreIdAndOwnerIdAndActiveTrue(STORE_ID, OWNER_ID))
            .thenReturn(Optional.of(new StoreOwner()));
    }

    @Test
    void acknowledgingAnIssueRecordsTheOwnerAsResponderSoTheEmployeeBadgeFires() {
        ownerOwnsStore();
        when(userRepository.findById(OWNER_ID)).thenReturn(Optional.of(owner));
        when(raisedIssueRepository.save(any(RaisedIssue.class))).thenAnswer(i -> i.getArgument(0));

        IssueResponse response = raisedIssueService.updateStatus(
            ISSUE_ID, OWNER_ID, new UpdateIssueStatusRequest("ACKNOWLEDGED", "Part ordered, arriving Friday.")
        );

        assertThat(response.status()).isEqualTo("ACKNOWLEDGED");
        assertThat(response.responseText()).isEqualTo("Part ordered, arriving Friday.");
        assertThat(response.respondedByFullName()).isEqualTo("Store Owner");
        assertThat(response.respondedBySuperAdmin()).isFalse();
        assertThat(issue.getRespondedAt()).isNotNull();
        verify(notificationService).createForIssueUpdate(issue, "ACKNOWLEDGED");
    }

    @Test
    void repeatingTheCurrentStatusIsANoOpWithNoDuplicateNotification() {
        issue.setStatus("ACKNOWLEDGED");
        ownerOwnsStore();

        IssueResponse response = raisedIssueService.updateStatus(
            ISSUE_ID, OWNER_ID, new UpdateIssueStatusRequest("ACKNOWLEDGED", null)
        );

        assertThat(response.status()).isEqualTo("ACKNOWLEDGED");
        verify(raisedIssueRepository, never()).save(any());
        verify(notificationService, never()).createForIssueUpdate(any(), any());
        verifyNoInteractions(activityLogService);
    }

    @Test
    void aResolvedIssueCannotBeReopened() {
        issue.setStatus("RESOLVED");
        ownerOwnsStore();

        assertThatThrownBy(() ->
            raisedIssueService.updateStatus(ISSUE_ID, OWNER_ID, new UpdateIssueStatusRequest("OPEN", null))
        ).isInstanceOf(InvalidIssueTransitionException.class);

        verify(raisedIssueRepository, never()).save(any());
    }

    @Test
    void anAcknowledgedIssueCannotGoBackToOpen() {
        issue.setStatus("ACKNOWLEDGED");
        ownerOwnsStore();

        assertThatThrownBy(() ->
            raisedIssueService.updateStatus(ISSUE_ID, OWNER_ID, new UpdateIssueStatusRequest("OPEN", null))
        ).isInstanceOf(InvalidIssueTransitionException.class);
    }

    @Test
    void aFormerOwnerWithARevokedLinkCannotListIssues() {
        when(storeOwnerRepository.findByStoreIdAndOwnerIdAndActiveTrue(STORE_ID, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> raisedIssueService.listForOwner(OWNER_ID, STORE_ID, null))
            .isInstanceOf(StoreNotFoundException.class);

        verify(raisedIssueRepository, never()).findByStoreIdOrderByCreatedAtDesc(any());
    }

    // ── Super Admin ───────────────────────────────────────────────────────────

    @Test
    void superAdminResolveRecordsTheSuperAdminAndNotifiesBothEmployeeAndOwner() {
        SuperAdmin sa = new SuperAdmin();
        ReflectionTestUtils.setField(sa, "name", "Platform Admin");
        StoreOwner link = new StoreOwner();
        link.setOwner(owner);
        when(raisedIssueRepository.findByIdWithEmployee(ISSUE_ID)).thenReturn(Optional.of(issue));
        when(raisedIssueRepository.save(any(RaisedIssue.class))).thenAnswer(i -> i.getArgument(0));
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(STORE_ID)).thenReturn(Optional.of(link));

        IssueResponse response = raisedIssueService.updateStatusForSuperAdmin(
            ISSUE_ID, sa, new UpdateIssueStatusRequest("RESOLVED", "Handled with the vendor.")
        );

        assertThat(response.respondedByFullName()).isEqualTo("Platform Admin");
        assertThat(response.respondedBySuperAdmin()).isTrue();
        assertThat(issue.getRespondedAt()).isNotNull();
        verify(notificationService).createForIssueUpdate(issue, "RESOLVED");
        verify(notificationService).notifyOwnerOfSuperAdminIssueUpdate(issue, owner, "RESOLVED");
        verify(activityLogService).log(eq("ISSUE_RESOLVED"), eq("Platform Admin"), eq("SUPER_ADMIN"),
            eq(STORE_ID), any(), eq("ISSUE"), any(), any());
    }

    // ── Nudge ─────────────────────────────────────────────────────────────────

    @Test
    void nudgingAResolvedIssueIsAConflict() {
        issue.setStatus("RESOLVED");
        when(raisedIssueRepository.findByIdWithEmployee(ISSUE_ID)).thenReturn(Optional.of(issue));

        assertThatThrownBy(() -> raisedIssueService.nudgeOwner(ISSUE_ID))
            .isInstanceOf(IssueAlreadyResolvedException.class);
        verify(notificationService, never()).nudgeOwnerForIssue(any(), any());
    }

    @Test
    void nudgingAStoreWithNoActiveOwnerIsAConflictNotASilentSuccess() {
        when(raisedIssueRepository.findByIdWithEmployee(ISSUE_ID)).thenReturn(Optional.of(issue));
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(STORE_ID)).thenReturn(Optional.of(new StoreOwner()));

        assertThatThrownBy(() -> raisedIssueService.nudgeOwner(ISSUE_ID))
            .isInstanceOf(StoreHasNoActiveOwnerException.class);
        verify(notificationService, never()).nudgeOwnerForIssue(any(), any());
    }

    @Test
    void nudgingTwiceWithinTheCooldownIsRejected() {
        StoreOwner link = new StoreOwner();
        link.setOwner(owner);
        when(raisedIssueRepository.findByIdWithEmployee(ISSUE_ID)).thenReturn(Optional.of(issue));
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(STORE_ID)).thenReturn(Optional.of(link));
        when(notificationService.issueNudgedSince(eq(ISSUE_ID), any())).thenReturn(true);

        assertThatThrownBy(() -> raisedIssueService.nudgeOwner(ISSUE_ID))
            .isInstanceOf(NudgeCooldownException.class);
        verify(notificationService, never()).nudgeOwnerForIssue(any(), any());
    }

    @Test
    void nudgingNotifiesTheActiveOwner() {
        StoreOwner link = new StoreOwner();
        link.setOwner(owner);
        when(raisedIssueRepository.findByIdWithEmployee(ISSUE_ID)).thenReturn(Optional.of(issue));
        when(storeOwnerRepository.findByStoreIdAndActiveTrue(STORE_ID)).thenReturn(Optional.of(link));
        when(notificationService.issueNudgedSince(eq(ISSUE_ID), any())).thenReturn(false);

        raisedIssueService.nudgeOwner(ISSUE_ID);

        verify(notificationService).nudgeOwnerForIssue(issue, owner);
    }
}
