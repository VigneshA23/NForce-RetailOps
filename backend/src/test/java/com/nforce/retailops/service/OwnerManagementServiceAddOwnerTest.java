package com.nforce.retailops.service;

import com.nforce.retailops.dto.AddOwnerRequest;
import com.nforce.retailops.dto.OwnerCreationResponse;
import com.nforce.retailops.dto.OwnerResponse;
import com.nforce.retailops.exception.EmailDeliveryException;
import com.nforce.retailops.exception.InvalidOwnerRequestException;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Proves addOwner's decoupled-from-the-transaction mail flow (see
// OwnerProvisioningService): on mail success emailSent=true and nothing is
// cleaned up; on mail failure the account SURVIVES (no compensation/rollback)
// and the response carries emailSent=false so the caller can trigger a resend
// via the Reset Password action.
@ExtendWith(MockitoExtension.class)
class OwnerManagementServiceAddOwnerTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private StoreRepository storeRepository;
    @Mock
    private StoreOwnerRepository storeOwnerRepository;
    @Mock
    private MailService mailService;
    @Mock
    private StoreCodeGenerator storeCodeGenerator;
    @Mock
    private OwnerProvisioningService ownerProvisioningService;
    @Mock
    private SuperAdminAlertService superAdminAlertService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private ActivityLogService activityLogService;
    @Mock
    private SessionService sessionService;
    @Mock
    private PasswordResetService passwordResetService;

    @InjectMocks
    private OwnerManagementService ownerManagementService;

    private AddOwnerRequest request;
    private OwnerProvisioningService.ProvisionedOwner provisioned;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(ownerManagementService, "appBaseUrl", "http://localhost:5173");
        request = new AddOwnerRequest("New Owner", "owner@nforce.test", null, null, null, null, null);
        OwnerResponse response = OwnerResponse.withoutStore(newUser());
        provisioned = new OwnerProvisioningService.ProvisionedOwner(
            5L, "owner@nforce.test", "New Owner", "temp-pass-123", null, null, false, null, response
        );
        when(passwordResetService.createSetupToken("owner@nforce.test")).thenReturn("test-token");
    }

    private com.nforce.retailops.entity.User newUser() {
        com.nforce.retailops.entity.User user = new com.nforce.retailops.entity.User();
        ReflectionTestUtils.setField(user, "id", 5L);
        user.setFullName("New Owner");
        user.setEmail("owner@nforce.test");
        return user;
    }

    @Test
    void onMailSuccessTheProvisionedResponsePassesThroughWithEmailSentTrue() {
        when(ownerProvisioningService.createOwnerAccount(eq(request), eq(false), eq(false))).thenReturn(provisioned);

        OwnerCreationResponse result = ownerManagementService.addOwner(request);

        assertThat(result.owner()).isEqualTo(provisioned.response());
        assertThat(result.temporaryPassword()).isNull();
        assertThat(result.emailSent()).isTrue();
        verify(mailService).sendAccountSetupEmail("owner@nforce.test", "New Owner", "http://localhost:5173?token=test-token");
        verify(ownerProvisioningService, never()).deleteUnreachableOwner(any());
    }

    @Test
    void onMailFailureTheAccountSurvivesAndResponseIndicatesEmailNotSent() {
        when(ownerProvisioningService.createOwnerAccount(eq(request), eq(false), eq(false))).thenReturn(provisioned);
        doThrow(new EmailDeliveryException("boom")).when(mailService)
            .sendAccountSetupEmail("owner@nforce.test", "New Owner", "http://localhost:5173?token=test-token");

        OwnerCreationResponse result = ownerManagementService.addOwner(request);

        assertThat(result.owner()).isEqualTo(provisioned.response());
        assertThat(result.temporaryPassword()).isNull();
        assertThat(result.emailSent()).isFalse();
        verify(ownerProvisioningService, never()).deleteUnreachableOwner(any());
    }

    @Test
    void requestShapeValidationStillRunsBeforeAnyProvisioningCall() {
        AddOwnerRequest conflicting = new AddOwnerRequest("New Owner", "owner@nforce.test", null, null, "Downtown", "Main St", 99L);

        assertThatThrownBy(() -> ownerManagementService.addOwner(conflicting))
            .isInstanceOf(InvalidOwnerRequestException.class);

        verify(ownerProvisioningService, never()).createOwnerAccount(any(), org.mockito.ArgumentMatchers.anyBoolean(), org.mockito.ArgumentMatchers.anyBoolean());
    }
}
