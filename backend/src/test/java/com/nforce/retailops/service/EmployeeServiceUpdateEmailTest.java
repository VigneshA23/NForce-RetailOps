package com.nforce.retailops.service;

import com.nforce.retailops.dto.EmployeeUpdateRequest;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmailAlreadyExistsException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmployeeServiceUpdateEmailTest {

    private static final Long OWNER_ID = 1L;
    private static final Long EMPLOYEE_ID = 7L;
    private static final String OLD_EMAIL = "jhon@nforce.test";

    @Mock
    private StoreEmployeeRepository storeEmployeeRepository;
    @Mock
    private StoreOwnerRepository storeOwnerRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ActivityLogService activityLogService;
    @Mock
    private AccountEmailChangeService accountEmailChangeService;

    @InjectMocks
    private EmployeeService employeeService;

    private User employee;
    private StoreEmployee storeEmployee;

    @BeforeEach
    void setUp() {
        User owner = new User();
        ReflectionTestUtils.setField(owner, "id", OWNER_ID);

        employee = new User();
        ReflectionTestUtils.setField(employee, "id", 42L);
        employee.setEmail(OLD_EMAIL);
        employee.setFullName("John Smith");

        storeEmployee = new StoreEmployee();
        ReflectionTestUtils.setField(storeEmployee, "id", EMPLOYEE_ID);
        storeEmployee.setEmployee(employee);
        // Manageable via creator, so no store lookups are needed.
        storeEmployee.setCreatedByOwner(owner);
    }

    private EmployeeUpdateRequest request(String email) {
        return new EmployeeUpdateRequest("John Smith", email, "5550100", "Full-time", "Male");
    }

    @Test
    void ownerChangingTheEmailHandsOffToTheEmailChangeFlow() {
        when(storeEmployeeRepository.findById(EMPLOYEE_ID)).thenReturn(Optional.of(storeEmployee));
        when(storeEmployeeRepository.save(storeEmployee)).thenReturn(storeEmployee);
        when(userRepository.findByEmailWithRoles("john@nforce.test")).thenReturn(Optional.empty());

        employeeService.updateEmployee(OWNER_ID, EMPLOYEE_ID, request(" john@nforce.test "));

        assertThat(employee.getEmail()).isEqualTo("john@nforce.test");
        verify(accountEmailChangeService).emailChanged(employee, OLD_EMAIL);
    }

    @Test
    void superAdminChangingTheEmailHandsOffToTheEmailChangeFlow() {
        when(storeEmployeeRepository.findById(EMPLOYEE_ID)).thenReturn(Optional.of(storeEmployee));
        when(storeEmployeeRepository.save(storeEmployee)).thenReturn(storeEmployee);
        when(userRepository.findByEmailWithRoles("john@nforce.test")).thenReturn(Optional.empty());

        employeeService.updateEmployeeAsSuperAdmin(EMPLOYEE_ID, request("john@nforce.test"));

        verify(accountEmailChangeService).emailChanged(employee, OLD_EMAIL);
    }

    @Test
    void editingOtherFieldsOrOnlyTheLetterCaseSendsNothing() {
        when(storeEmployeeRepository.findById(EMPLOYEE_ID)).thenReturn(Optional.of(storeEmployee));
        when(storeEmployeeRepository.save(storeEmployee)).thenReturn(storeEmployee);

        employeeService.updateEmployee(OWNER_ID, EMPLOYEE_ID, request("JHON@nforce.test"));

        verify(accountEmailChangeService, never()).emailChanged(any(), any());
    }

    @Test
    void anEmailAlreadyInUseIsRefusedBeforeAnythingChanges() {
        when(storeEmployeeRepository.findById(EMPLOYEE_ID)).thenReturn(Optional.of(storeEmployee));
        when(userRepository.findByEmailWithRoles("taken@nforce.test")).thenReturn(Optional.of(new User()));

        assertThatThrownBy(() -> employeeService.updateEmployee(OWNER_ID, EMPLOYEE_ID, request("taken@nforce.test")))
            .isInstanceOf(EmailAlreadyExistsException.class);

        assertThat(employee.getEmail()).isEqualTo(OLD_EMAIL);
        verify(accountEmailChangeService, never()).emailChanged(any(), any());
    }
}
