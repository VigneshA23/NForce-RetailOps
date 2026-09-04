package com.nforce.retailops.service;

import com.nforce.retailops.dto.EmployeeCreateRequest;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmailAlreadyExistsException;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmployeeProvisioningServiceTest {

    private static final Long OWNER_ID = 1L;

    @Mock
    private StoreEmployeeRepository storeEmployeeRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private TemporaryPasswordGenerator temporaryPasswordGenerator;

    private EmployeeProvisioningService employeeProvisioningService;

    @BeforeEach
    void setUp() {
        employeeProvisioningService = new EmployeeProvisioningService(
            storeEmployeeRepository, userRepository, roleRepository, passwordEncoder, temporaryPasswordGenerator
        );
    }

    private EmployeeCreateRequest request() {
        return new EmployeeCreateRequest("Jane Doe", "jane@nforce.test", "555-0100", "Morning", "Full Time", "Female");
    }

    @Test
    void createEmployeeAccountPersistsAndReturnsProvisionedDetails() {
        when(userRepository.findByEmailWithRoles("jane@nforce.test")).thenReturn(Optional.empty());
        Role role = new Role();
        when(roleRepository.findByName("EMPLOYEE")).thenReturn(Optional.of(role));
        when(temporaryPasswordGenerator.generate()).thenReturn("temp-pass-123");
        when(passwordEncoder.encode("temp-pass-123")).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            ReflectionTestUtils.setField(user, "id", 42L);
            return user;
        });
        User ownerRef = new User();
        ReflectionTestUtils.setField(ownerRef, "id", OWNER_ID);
        when(userRepository.getReferenceById(OWNER_ID)).thenReturn(ownerRef);
        when(storeEmployeeRepository.save(any(StoreEmployee.class))).thenAnswer(invocation -> {
            StoreEmployee storeEmployee = invocation.getArgument(0);
            ReflectionTestUtils.setField(storeEmployee, "id", 7L);
            return storeEmployee;
        });

        EmployeeProvisioningService.ProvisionedEmployee provisioned =
            employeeProvisioningService.createEmployeeAccount(OWNER_ID, request(), Set.of());

        assertThat(provisioned.userId()).isEqualTo(42L);
        assertThat(provisioned.storeEmployeeId()).isEqualTo(7L);
        assertThat(provisioned.email()).isEqualTo("jane@nforce.test");
        assertThat(provisioned.fullName()).isEqualTo("Jane Doe");
        assertThat(provisioned.temporaryPassword()).isEqualTo("temp-pass-123");
        assertThat(provisioned.response().id()).isEqualTo(7L);
        assertThat(provisioned.response().name()).isEqualTo("Jane Doe");
        assertThat(provisioned.response().email()).isEqualTo("jane@nforce.test");
    }

    @Test
    void createEmployeeAccountRejectsADuplicateEmailWithoutPersistingAnything() {
        when(userRepository.findByEmailWithRoles("jane@nforce.test")).thenReturn(Optional.of(new User()));

        assertThatThrownBy(() -> employeeProvisioningService.createEmployeeAccount(OWNER_ID, request(), Set.of()))
            .isInstanceOf(EmailAlreadyExistsException.class);

        verify(userRepository, never()).save(any(User.class));
        verify(storeEmployeeRepository, never()).save(any(StoreEmployee.class));
    }

    @Test
    void deleteUnreachableEmployeeDeletesTheStoreEmployeeRowBeforeTheUserRow() {
        employeeProvisioningService.deleteUnreachableEmployee(7L, 42L);

        InOrder order = inOrder(storeEmployeeRepository, userRepository);
        order.verify(storeEmployeeRepository).deleteById(7L);
        order.verify(userRepository).deleteById(42L);
    }
}
