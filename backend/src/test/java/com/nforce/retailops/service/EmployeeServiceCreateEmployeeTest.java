package com.nforce.retailops.service;

import com.nforce.retailops.dto.EmployeeCreateRequest;
import com.nforce.retailops.dto.EmployeeResponse;
import com.nforce.retailops.exception.EmailDeliveryException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Proves createEmployee's decoupled-from-the-transaction mail flow (see
// EmployeeProvisioningService): on mail success nothing is cleaned up and the
// provisioned response passes through unchanged; on mail failure the account
// is compensated away and the original EmailDeliveryException still surfaces
// to the caller exactly as it did when this was one @Transactional method.
@ExtendWith(MockitoExtension.class)
class EmployeeServiceCreateEmployeeTest {

    private static final Long OWNER_ID = 1L;

    @Mock
    private StoreEmployeeRepository storeEmployeeRepository;
    @Mock
    private StoreOwnerRepository storeOwnerRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private SessionService sessionService;
    @Mock
    private MailService mailService;
    @Mock
    private EmployeeProvisioningService employeeProvisioningService;

    @InjectMocks
    private EmployeeService employeeService;

    private EmployeeCreateRequest request;
    private EmployeeProvisioningService.ProvisionedEmployee provisioned;

    @BeforeEach
    void setUp() {
        request = new EmployeeCreateRequest("Jane Doe", "jane@nforce.test", "555-0100", "Morning", "Full Time", "Female", List.of());
        EmployeeResponse response =
            new EmployeeResponse(7L, "EMP-007", "Jane Doe", "jane@nforce.test", "555-0100", "Morning", "Full Time", "Female", true, List.of());
        provisioned = new EmployeeProvisioningService.ProvisionedEmployee(
            42L, 7L, "jane@nforce.test", "Jane Doe", "temp-pass-123", response
        );
        when(employeeProvisioningService.createEmployeeAccount(eq(OWNER_ID), eq(request), any())).thenReturn(provisioned);
    }

    @Test
    void onMailSuccessTheProvisionedResponsePassesThroughAndNothingIsCleanedUp() {
        EmployeeResponse result = employeeService.createEmployee(OWNER_ID, request);

        assertThat(result).isEqualTo(provisioned.response());
        verify(mailService).sendTemporaryPassword("jane@nforce.test", "Jane Doe", "temp-pass-123");
        verify(employeeProvisioningService, never()).deleteUnreachableEmployee(any(), any());
    }

    @Test
    void onMailFailureTheAccountIsCleanedUpAndTheOriginalExceptionSurfacesUnchanged() {
        doThrow(new EmailDeliveryException("boom")).when(mailService)
            .sendTemporaryPassword("jane@nforce.test", "Jane Doe", "temp-pass-123");

        assertThatThrownBy(() -> employeeService.createEmployee(OWNER_ID, request))
            .isInstanceOf(EmailDeliveryException.class)
            .hasMessage("boom");

        verify(employeeProvisioningService).deleteUnreachableEmployee(7L, 42L);
    }
}
