package com.nforce.retailops.service;

import com.nforce.retailops.dto.AddOwnerRequest;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Proves addOwner's decoupled-from-the-transaction mail flow (see
// OwnerProvisioningService): on mail success nothing is cleaned up and the
// provisioned response passes through unchanged; on mail failure the account
// (and any store change) is compensated away and the original
// EmailDeliveryException still surfaces to the caller exactly as it did when
// this was one @Transactional method.
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

    @InjectMocks
    private OwnerManagementService ownerManagementService;

    private AddOwnerRequest request;
    private OwnerProvisioningService.ProvisionedOwner provisioned;

    @BeforeEach
    void setUp() {
        request = new AddOwnerRequest("New Owner", "owner@nforce.test", null, null, null);
        OwnerResponse response = OwnerResponse.withoutStore(newUser());
        provisioned = new OwnerProvisioningService.ProvisionedOwner(
            5L, "owner@nforce.test", "New Owner", "temp-pass-123", null, null, null, response
        );
    }

    private com.nforce.retailops.entity.User newUser() {
        com.nforce.retailops.entity.User user = new com.nforce.retailops.entity.User();
        org.springframework.test.util.ReflectionTestUtils.setField(user, "id", 5L);
        user.setFullName("New Owner");
        user.setEmail("owner@nforce.test");
        return user;
    }

    @Test
    void onMailSuccessTheProvisionedResponsePassesThroughAndNothingIsCleanedUp() {
        when(ownerProvisioningService.createOwnerAccount(eq(request), eq(false), eq(false))).thenReturn(provisioned);

        OwnerResponse result = ownerManagementService.addOwner(request);

        assertThat(result).isEqualTo(provisioned.response());
        verify(mailService).sendTemporaryPassword("owner@nforce.test", "New Owner", "temp-pass-123");
        verify(ownerProvisioningService, never()).deleteUnreachableOwner(any());
    }

    @Test
    void onMailFailureTheAccountIsCleanedUpAndTheOriginalExceptionSurfacesUnchanged() {
        when(ownerProvisioningService.createOwnerAccount(eq(request), eq(false), eq(false))).thenReturn(provisioned);
        doThrow(new EmailDeliveryException("boom")).when(mailService)
            .sendTemporaryPassword("owner@nforce.test", "New Owner", "temp-pass-123");

        assertThatThrownBy(() -> ownerManagementService.addOwner(request))
            .isInstanceOf(EmailDeliveryException.class)
            .hasMessage("boom");

        verify(ownerProvisioningService).deleteUnreachableOwner(provisioned);
    }

    @Test
    void requestShapeValidationStillRunsBeforeAnyProvisioningCall() {
        AddOwnerRequest conflicting = new AddOwnerRequest("New Owner", "owner@nforce.test", "Downtown", "Main St", 99L);

        assertThatThrownBy(() -> ownerManagementService.addOwner(conflicting))
            .isInstanceOf(InvalidOwnerRequestException.class);

        verify(ownerProvisioningService, never()).createOwnerAccount(any(), org.mockito.ArgumentMatchers.anyBoolean(), org.mockito.ArgumentMatchers.anyBoolean());
    }
}
