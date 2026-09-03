package com.nforce.retailops.service;

import com.nforce.retailops.dto.EmployeeResponse;
import com.nforce.retailops.dto.UpdateEmployeeStatusRequest;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmployeeNotFoundException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmployeeServiceStatusTest {

    private static final Long OWNER_ID = 1L;
    private static final Long EMPLOYEE_ID = 7L;
    private static final String EMPLOYEE_EMAIL = "employee@nforce.test";

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
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private TemporaryPasswordGenerator temporaryPasswordGenerator;

    @InjectMocks
    private EmployeeService employeeService;

    private User owner;
    private StoreEmployee storeEmployee;

    @BeforeEach
    void setUp() {
        owner = new User();
        ReflectionTestUtils.setField(owner, "id", OWNER_ID);

        User employee = new User();
        ReflectionTestUtils.setField(employee, "id", 42L);
        employee.setEmail(EMPLOYEE_EMAIL);
        employee.setFullName("Test Employee");
        employee.setActive(true);

        storeEmployee = new StoreEmployee();
        ReflectionTestUtils.setField(storeEmployee, "id", EMPLOYEE_ID);
        storeEmployee.setEmployee(employee);
        // Manageable via creator, so no store lookups are needed.
        storeEmployee.setCreatedByOwner(owner);
    }

    @Test
    void deactivatingClearsTheFlagAndRevokesEverySessionTheEmployeeHolds() {
        when(storeEmployeeRepository.findById(EMPLOYEE_ID)).thenReturn(Optional.of(storeEmployee));

        EmployeeResponse response =
            employeeService.setEmployeeActive(OWNER_ID, EMPLOYEE_ID, new UpdateEmployeeStatusRequest(false));

        assertThat(response.active()).isFalse();
        assertThat(storeEmployee.getEmployee().isActive()).isFalse();
        verify(userRepository).save(storeEmployee.getEmployee());
        verify(sessionService).invalidateAllForUser(EMPLOYEE_EMAIL);
    }

    @Test
    void reactivatingSetsTheFlagBackAndLeavesSessionsAlone() {
        storeEmployee.getEmployee().setActive(false);
        when(storeEmployeeRepository.findById(EMPLOYEE_ID)).thenReturn(Optional.of(storeEmployee));

        EmployeeResponse response =
            employeeService.setEmployeeActive(OWNER_ID, EMPLOYEE_ID, new UpdateEmployeeStatusRequest(true));

        assertThat(response.active()).isTrue();
        verify(sessionService, never()).invalidateAllForUser(anyString());
    }

    @Test
    void ownerWhoCannotManageTheEmployeeGetsNotFoundRatherThanForbidden() {
        StoreEmployee otherOwnersEmployee = new StoreEmployee();
        ReflectionTestUtils.setField(otherOwnersEmployee, "id", EMPLOYEE_ID);
        otherOwnersEmployee.setEmployee(storeEmployee.getEmployee());
        User otherOwner = new User();
        ReflectionTestUtils.setField(otherOwner, "id", 99L);
        otherOwnersEmployee.setCreatedByOwner(otherOwner);
        when(storeEmployeeRepository.findById(EMPLOYEE_ID)).thenReturn(Optional.of(otherOwnersEmployee));

        assertThatThrownBy(() ->
            employeeService.setEmployeeActive(OWNER_ID, EMPLOYEE_ID, new UpdateEmployeeStatusRequest(false))
        ).isInstanceOf(EmployeeNotFoundException.class);

        verify(userRepository, never()).save(any(User.class));
        verify(sessionService, never()).invalidateAllForUser(anyString());
    }

    @Test
    void resettingPasswordGeneratesAndEmailsANewTemporaryPasswordAndRevokesSessions() {
        when(storeEmployeeRepository.findById(EMPLOYEE_ID)).thenReturn(Optional.of(storeEmployee));
        when(temporaryPasswordGenerator.generate()).thenReturn("Temp-Pass1");
        when(passwordEncoder.encode("Temp-Pass1")).thenReturn("hashed");

        employeeService.resetEmployeePassword(OWNER_ID, EMPLOYEE_ID);

        assertThat(storeEmployee.getEmployee().getPasswordHash()).isEqualTo("hashed");
        assertThat(storeEmployee.getEmployee().isMustResetPassword()).isTrue();
        verify(userRepository).save(storeEmployee.getEmployee());
        verify(sessionService).invalidateAllForUser(EMPLOYEE_EMAIL);
        verify(mailService).sendPasswordReset(EMPLOYEE_EMAIL, "Test Employee", "Temp-Pass1");
    }

    @Test
    void resettingPasswordForAnEmployeeTheOwnerCannotManageIsNotFound() {
        StoreEmployee otherOwnersEmployee = new StoreEmployee();
        ReflectionTestUtils.setField(otherOwnersEmployee, "id", EMPLOYEE_ID);
        otherOwnersEmployee.setEmployee(storeEmployee.getEmployee());
        User otherOwner = new User();
        ReflectionTestUtils.setField(otherOwner, "id", 99L);
        otherOwnersEmployee.setCreatedByOwner(otherOwner);
        when(storeEmployeeRepository.findById(EMPLOYEE_ID)).thenReturn(Optional.of(otherOwnersEmployee));

        assertThatThrownBy(() -> employeeService.resetEmployeePassword(OWNER_ID, EMPLOYEE_ID))
            .isInstanceOf(EmployeeNotFoundException.class);

        verify(mailService, never()).sendPasswordReset(anyString(), anyString(), anyString());
        verify(sessionService, never()).invalidateAllForUser(anyString());
    }

    @Test
    void deletingAnEmployeeAlsoRevokesTheirSessions() {
        when(storeEmployeeRepository.findById(EMPLOYEE_ID)).thenReturn(Optional.of(storeEmployee));

        employeeService.deleteEmployee(OWNER_ID, EMPLOYEE_ID);

        verify(sessionService).invalidateAllForUser(EMPLOYEE_EMAIL);
        verify(storeEmployeeRepository).delete(storeEmployee);
        verify(userRepository).delete(storeEmployee.getEmployee());
    }
}
