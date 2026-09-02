package com.nforce.retailops.service;

import com.nforce.retailops.dto.AssignedStoreResponse;
import com.nforce.retailops.dto.MeResponse;
import com.nforce.retailops.dto.UpdateMeRequest;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreEmployee;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.EmailAlreadyExistsException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserProfileServiceTest {

    private static final Long USER_ID = 5L;

    @Mock
    private StoreOwnerRepository storeOwnerRepository;
    @Mock
    private StoreEmployeeRepository storeEmployeeRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserProfileService userProfileService;

    private static Store store(Long id, String name) {
        Store store = new Store();
        ReflectionTestUtils.setField(store, "id", id);
        store.setName(name);
        store.setLocation(name + " Road");
        store.setActive(true);
        return store;
    }

    private static User user(String roleName) {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", USER_ID);
        user.setFullName("Test User");
        user.setEmail("test@nforce.test");

        Role role = new Role();
        role.setName(roleName);
        user.getRoles().add(role);
        return user;
    }

    private void employeeAssignedTo(Store... stores) {
        StoreEmployee storeEmployee = new StoreEmployee();
        storeEmployee.setStores(new LinkedHashSet<>(List.of(stores)));
        when(storeEmployeeRepository.findByEmployeeId(USER_ID)).thenReturn(Optional.of(storeEmployee));
    }

    @Test
    void employeeSeesOnlyTheStoresTheyAreAssignedTo() {
        employeeAssignedTo(store(2L, "Beta"), store(1L, "Alpha"));

        List<AssignedStoreResponse> stores = userProfileService.listMyStores(user("EMPLOYEE"));

        // Sorted by name so the picker order is stable.
        assertThat(stores).extracting(AssignedStoreResponse::name).containsExactly("Alpha", "Beta");
        assertThat(stores).extracting(AssignedStoreResponse::id).containsExactly(1L, 2L);
    }

    @Test
    void employeeWithNoAssignmentSeesAnEmptyList() {
        when(storeEmployeeRepository.findByEmployeeId(USER_ID)).thenReturn(Optional.empty());

        assertThat(userProfileService.listMyStores(user("EMPLOYEE"))).isEmpty();
    }

    @Test
    void ownerSeesTheirOwnStores() {
        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(store(9L, "Owned"));
        when(storeOwnerRepository.findByOwnerId(USER_ID)).thenReturn(List.of(storeOwner));

        List<AssignedStoreResponse> stores = userProfileService.listMyStores(user("OWNER_ADMIN"));

        assertThat(stores).extracting(AssignedStoreResponse::name).containsExactly("Owned");
    }

    @Test
    void getMeReportsTheEmployeesRealStoreNames() {
        employeeAssignedTo(store(1L, "Alpha"));

        MeResponse me = userProfileService.getMe(user("EMPLOYEE"));

        assertThat(me.role()).isEqualTo("EMPLOYEE");
        assertThat(me.storeNames()).containsExactly("Alpha");
    }

    @Test
    void requireAssignedStorePassesForAStoreTheEmployeeIsAssignedTo() {
        when(storeEmployeeRepository.existsByEmployeeIdAndStoresId(USER_ID, 1L)).thenReturn(true);

        assertThatCode(() -> userProfileService.requireAssignedStore(USER_ID, 1L)).doesNotThrowAnyException();
    }

    @Test
    void requireAssignedStoreMasksAnUnassignedStoreAsNotFound() {
        when(storeEmployeeRepository.existsByEmployeeIdAndStoresId(USER_ID, 42L)).thenReturn(false);

        assertThatThrownBy(() -> userProfileService.requireAssignedStore(USER_ID, 42L))
            .isInstanceOf(StoreNotFoundException.class)
            .hasMessage("Store not found");
    }

    @Test
    void updateMeAppliesNameEmailAndPhoneForAnEmployee() {
        User employee = user("EMPLOYEE");
        StoreEmployee storeEmployee = new StoreEmployee();
        storeEmployee.setPhone("555-0000");
        when(storeEmployeeRepository.findByEmployeeId(USER_ID)).thenReturn(Optional.of(storeEmployee));
        when(userRepository.findByEmailWithRoles("new@nforce.test")).thenReturn(Optional.empty());

        MeResponse updated = userProfileService.updateMe(
            employee, new UpdateMeRequest("New Name", "new@nforce.test", "555-1234"));

        assertThat(employee.getFullName()).isEqualTo("New Name");
        assertThat(employee.getEmail()).isEqualTo("new@nforce.test");
        assertThat(storeEmployee.getPhone()).isEqualTo("555-1234");
        assertThat(updated.fullName()).isEqualTo("New Name");
        assertThat(updated.phone()).isEqualTo("555-1234");
    }

    @Test
    void updateMeRejectsAnEmailAlreadyUsedBySomeoneElse() {
        User employee = user("EMPLOYEE");
        when(userRepository.findByEmailWithRoles("taken@nforce.test")).thenReturn(Optional.of(new User()));

        assertThatThrownBy(() -> userProfileService.updateMe(
            employee, new UpdateMeRequest("New Name", "taken@nforce.test", "555-1234")))
            .isInstanceOf(EmailAlreadyExistsException.class);
    }

    @Test
    void updateMeAllowsKeepingTheSameEmail() {
        User employee = user("EMPLOYEE");
        when(storeEmployeeRepository.findByEmployeeId(USER_ID)).thenReturn(Optional.empty());

        assertThatCode(() -> userProfileService.updateMe(
            employee, new UpdateMeRequest("New Name", employee.getEmail(), "555-1234")))
            .doesNotThrowAnyException();
    }
}
