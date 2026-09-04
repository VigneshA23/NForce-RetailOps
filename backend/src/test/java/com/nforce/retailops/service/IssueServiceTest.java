package com.nforce.retailops.service;

import com.nforce.retailops.dto.IssueResponse;
import com.nforce.retailops.dto.RaiseIssueRequest;
import com.nforce.retailops.dto.RespondIssueRequest;
import com.nforce.retailops.entity.IssueStatus;
import com.nforce.retailops.entity.RaisedIssue;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.IssueNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.RaisedIssueRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.UserRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

// Proves the core of the "Raise with Owner" -> Admin response -> Employee
// notification pipeline at the service layer: an owner can only respond to
// issues on stores they own, and a successful response both resolves the
// issue and notifies the employee who raised it (NotificationService).
@ExtendWith(MockitoExtension.class)
class IssueServiceTest {

    private static final Long OWNER_ID = 1L;
    private static final Long STORE_ID = 10L;
    private static final Long EMPLOYEE_ID = 42L;
    private static final Long ISSUE_ID = 7L;

    @Mock
    private RaisedIssueRepository raisedIssueRepository;
    @Mock
    private StoreOwnerRepository storeOwnerRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private UserProfileService userProfileService;
    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private IssueService issueService;

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
        issue.setEmployee(employee);
        issue.setNote("The ice cream machine is broken.");
        issue.setStatus(IssueStatus.OPEN);
    }

    @Test
    void raisingAnIssuePersistsItAgainstTheEmployeesAssignedStore() {
        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store);
        storeOwner.setOwner(owner);
        when(storeOwnerRepository.findByStoreId(STORE_ID)).thenReturn(Optional.of(storeOwner));
        when(userRepository.getReferenceById(EMPLOYEE_ID)).thenReturn(employee);
        when(raisedIssueRepository.save(any(RaisedIssue.class))).thenAnswer(invocation -> invocation.getArgument(0));

        IssueResponse response = issueService.raiseIssue(EMPLOYEE_ID, new RaiseIssueRequest(STORE_ID, "  Freezer is loud.  "));

        verify(userProfileService).requireAssignedStore(EMPLOYEE_ID, STORE_ID);
        assertThat(response.note()).isEqualTo("Freezer is loud.");
        assertThat(response.status()).isEqualTo("OPEN");
        assertThat(response.storeId()).isEqualTo(STORE_ID);
    }

    @Test
    void respondingToAnIssueResolvesItAndNotifiesTheRaisingEmployee() {
        when(storeOwnerRepository.findByStoreIdAndOwnerId(STORE_ID, OWNER_ID))
            .thenReturn(Optional.of(new StoreOwner()));
        when(raisedIssueRepository.findByIdAndStoreId(ISSUE_ID, STORE_ID)).thenReturn(Optional.of(issue));
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(owner);
        when(raisedIssueRepository.save(any(RaisedIssue.class))).thenAnswer(invocation -> invocation.getArgument(0));

        IssueResponse response = issueService.respondToIssue(
            OWNER_ID, STORE_ID, ISSUE_ID, new RespondIssueRequest("We've scheduled a repair for tomorrow.")
        );

        assertThat(response.status()).isEqualTo("RESOLVED");
        assertThat(response.responseText()).isEqualTo("We've scheduled a repair for tomorrow.");
        assertThat(issue.getRespondedBy()).isEqualTo(owner);
        assertThat(issue.getRespondedAt()).isNotNull();

        ArgumentCaptor<RaisedIssue> notified = ArgumentCaptor.forClass(RaisedIssue.class);
        verify(notificationService).notifyIssueResponse(notified.capture());
        assertThat(notified.getValue().getEmployee()).isEqualTo(employee);
        assertThat(notified.getValue().getResponseText()).isEqualTo("We've scheduled a repair for tomorrow.");
    }

    @Test
    void respondingAsAnOwnerWhoDoesNotOwnTheStoreIsRejected() {
        when(storeOwnerRepository.findByStoreIdAndOwnerId(STORE_ID, OWNER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
            issueService.respondToIssue(OWNER_ID, STORE_ID, ISSUE_ID, new RespondIssueRequest("Nope."))
        ).isInstanceOf(StoreNotFoundException.class);

        verify(raisedIssueRepository, never()).save(any());
        verify(notificationService, never()).notifyIssueResponse(any());
    }

    @Test
    void respondingToAnIssueThatDoesNotBelongToTheStoreIsNotFound() {
        when(storeOwnerRepository.findByStoreIdAndOwnerId(STORE_ID, OWNER_ID))
            .thenReturn(Optional.of(new StoreOwner()));
        when(raisedIssueRepository.findByIdAndStoreId(ISSUE_ID, STORE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
            issueService.respondToIssue(OWNER_ID, STORE_ID, ISSUE_ID, new RespondIssueRequest("Nope."))
        ).isInstanceOf(IssueNotFoundException.class);

        verify(notificationService, never()).notifyIssueResponse(any());
    }
}
