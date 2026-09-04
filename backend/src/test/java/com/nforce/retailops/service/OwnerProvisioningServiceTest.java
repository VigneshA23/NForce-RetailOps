package com.nforce.retailops.service;

import com.nforce.retailops.dto.AddOwnerRequest;
import com.nforce.retailops.entity.Role;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.RoleRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OwnerProvisioningServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private StoreRepository storeRepository;
    @Mock
    private StoreOwnerRepository storeOwnerRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private TemporaryPasswordGenerator temporaryPasswordGenerator;
    @Mock
    private StoreCodeGenerator storeCodeGenerator;

    private OwnerProvisioningService ownerProvisioningService;

    @BeforeEach
    void setUp() {
        ownerProvisioningService = new OwnerProvisioningService(
            userRepository, roleRepository, storeRepository, storeOwnerRepository,
            passwordEncoder, temporaryPasswordGenerator, storeCodeGenerator
        );
    }

    // Stubs shared only by the createOwnerAccount tests -- kept out of
    // @BeforeEach so the deleteUnreachableOwner tests below don't fail
    // Mockito's strict-stubbing check with stubs they never exercise.
    private void stubCreateAccountHappyPath() {
        when(userRepository.findByEmailWithRoles("owner@nforce.test")).thenReturn(Optional.empty());
        when(roleRepository.findByName("OWNER_ADMIN")).thenReturn(Optional.of(new Role()));
        when(temporaryPasswordGenerator.generate()).thenReturn("temp-pass-123");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            ReflectionTestUtils.setField(user, "id", 5L);
            return user;
        });
    }

    private AddOwnerRequest requestWithNoStore() {
        return new AddOwnerRequest("New Owner", "owner@nforce.test", null, null, null);
    }

    private AddOwnerRequest requestWithNewStore() {
        return new AddOwnerRequest("New Owner", "owner@nforce.test", "Downtown", "Main St", null);
    }

    private AddOwnerRequest requestWithExistingStore(Long existingStoreId) {
        return new AddOwnerRequest("New Owner", "owner@nforce.test", null, null, existingStoreId);
    }

    @Test
    void createOwnerAccountWithNoStoreReturnsAResponseWithoutAStore() {
        stubCreateAccountHappyPath();
        var provisioned = ownerProvisioningService.createOwnerAccount(requestWithNoStore(), false, false);

        assertThat(provisioned.ownerId()).isEqualTo(5L);
        assertThat(provisioned.storeOwnerId()).isNull();
        assertThat(provisioned.newStoreId()).isNull();
        assertThat(provisioned.previousOwnerIdIfReassigned()).isNull();
        assertThat(provisioned.response().ownerId()).isEqualTo(5L);
        assertThat(provisioned.response().storeId()).isNull();
    }

    @Test
    void createOwnerAccountWithANewStoreCreatesBothRows() {
        stubCreateAccountHappyPath();
        when(storeCodeGenerator.next()).thenReturn(100L);
        when(storeRepository.save(any(Store.class))).thenAnswer(invocation -> {
            Store store = invocation.getArgument(0);
            ReflectionTestUtils.setField(store, "id", 20L);
            return store;
        });
        when(storeOwnerRepository.save(any(StoreOwner.class))).thenAnswer(invocation -> {
            StoreOwner storeOwner = invocation.getArgument(0);
            ReflectionTestUtils.setField(storeOwner, "id", 30L);
            return storeOwner;
        });

        var provisioned = ownerProvisioningService.createOwnerAccount(requestWithNewStore(), true, false);

        assertThat(provisioned.newStoreId()).isEqualTo(20L);
        assertThat(provisioned.storeOwnerId()).isEqualTo(30L);
        assertThat(provisioned.previousOwnerIdIfReassigned()).isNull();
        assertThat(provisioned.response().storeId()).isEqualTo(20L);
    }

    @Test
    void createOwnerAccountWithAnExistingStoreCapturesThePriorOwnerBeforeReassigning() {
        stubCreateAccountHappyPath();
        User previousOwner = new User();
        ReflectionTestUtils.setField(previousOwner, "id", 99L);
        Store store = new Store();
        ReflectionTestUtils.setField(store, "id", 20L);
        store.setName("Downtown");
        store.setStoreCode(100L);
        StoreOwner existingLink = new StoreOwner();
        ReflectionTestUtils.setField(existingLink, "id", 30L);
        existingLink.setStore(store);
        existingLink.setOwner(previousOwner);
        existingLink.setActive(false);
        when(storeOwnerRepository.findByStoreId(20L)).thenReturn(Optional.of(existingLink));
        when(storeOwnerRepository.save(any(StoreOwner.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var provisioned = ownerProvisioningService.createOwnerAccount(requestWithExistingStore(20L), false, true);

        assertThat(provisioned.previousOwnerIdIfReassigned()).isEqualTo(99L);
        assertThat(provisioned.storeOwnerId()).isEqualTo(30L);
        assertThat(provisioned.newStoreId()).isNull();
        assertThat(existingLink.getOwner().getId()).isEqualTo(5L);
        assertThat(existingLink.isActive()).isTrue();
    }

    @Test
    void createOwnerAccountWithANeverOwnedExistingStoreLeavesNoPreviousOwner() {
        stubCreateAccountHappyPath();
        Store store = new Store();
        ReflectionTestUtils.setField(store, "id", 20L);
        store.setName("Downtown");
        store.setStoreCode(100L);
        StoreOwner existingLink = new StoreOwner();
        ReflectionTestUtils.setField(existingLink, "id", 30L);
        existingLink.setStore(store);
        existingLink.setActive(false);
        when(storeOwnerRepository.findByStoreId(20L)).thenReturn(Optional.of(existingLink));
        when(storeOwnerRepository.save(any(StoreOwner.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var provisioned = ownerProvisioningService.createOwnerAccount(requestWithExistingStore(20L), false, true);

        assertThat(provisioned.reassignedExistingStore()).isTrue();
        assertThat(provisioned.previousOwnerIdIfReassigned()).isNull();
        assertThat(existingLink.getOwner().getId()).isEqualTo(5L);
        assertThat(existingLink.isActive()).isTrue();
    }

    @Test
    void deleteUnreachableOwnerForTheNoStoreCaseOnlyDeletesTheOwnerRow() {
        var provisioned = new OwnerProvisioningService.ProvisionedOwner(
            5L, "owner@nforce.test", "New Owner", "temp-pass-123", null, null, false, null, null
        );

        ownerProvisioningService.deleteUnreachableOwner(provisioned);

        verify(storeOwnerRepository, never()).deleteById(any());
        verify(storeRepository, never()).deleteById(any());
        verify(userRepository).deleteById(5L);
    }

    @Test
    void deleteUnreachableOwnerForTheNewStoreCaseDeletesTheLinkThenTheStoreThenTheOwner() {
        var provisioned = new OwnerProvisioningService.ProvisionedOwner(
            5L, "owner@nforce.test", "New Owner", "temp-pass-123", 30L, 20L, false, null, null
        );

        ownerProvisioningService.deleteUnreachableOwner(provisioned);

        InOrder order = inOrder(storeOwnerRepository, storeRepository, userRepository);
        order.verify(storeOwnerRepository).deleteById(30L);
        order.verify(storeRepository).deleteById(20L);
        order.verify(userRepository).deleteById(5L);
    }

    @Test
    void deleteUnreachableOwnerForTheExistingStoreCaseRevertsRatherThanDeletes() {
        StoreOwner existingLink = new StoreOwner();
        ReflectionTestUtils.setField(existingLink, "id", 30L);
        existingLink.setActive(true);
        when(storeOwnerRepository.findById(30L)).thenReturn(Optional.of(existingLink));
        User previousOwnerRef = new User();
        ReflectionTestUtils.setField(previousOwnerRef, "id", 99L);
        when(userRepository.getReferenceById(99L)).thenReturn(previousOwnerRef);

        var provisioned = new OwnerProvisioningService.ProvisionedOwner(
            5L, "owner@nforce.test", "New Owner", "temp-pass-123", 30L, null, true, 99L, null
        );

        ownerProvisioningService.deleteUnreachableOwner(provisioned);

        ArgumentCaptor<StoreOwner> savedCaptor = ArgumentCaptor.forClass(StoreOwner.class);
        InOrder order = inOrder(storeOwnerRepository, userRepository);
        order.verify(storeOwnerRepository).save(savedCaptor.capture());
        order.verify(userRepository).deleteById(5L);
        assertThat(savedCaptor.getValue().getOwner().getId()).isEqualTo(99L);
        assertThat(savedCaptor.getValue().isActive()).isFalse();
        verify(storeOwnerRepository, never()).deleteById(any());
        verify(storeRepository, never()).deleteById(any());
    }

    @Test
    void deleteUnreachableOwnerForTheNeverOwnedExistingStoreCaseRevertsToNoOwner() {
        StoreOwner existingLink = new StoreOwner();
        ReflectionTestUtils.setField(existingLink, "id", 30L);
        existingLink.setActive(true);
        when(storeOwnerRepository.findById(30L)).thenReturn(Optional.of(existingLink));

        var provisioned = new OwnerProvisioningService.ProvisionedOwner(
            5L, "owner@nforce.test", "New Owner", "temp-pass-123", 30L, null, true, null, null
        );

        ownerProvisioningService.deleteUnreachableOwner(provisioned);

        ArgumentCaptor<StoreOwner> savedCaptor = ArgumentCaptor.forClass(StoreOwner.class);
        InOrder order = inOrder(storeOwnerRepository, userRepository);
        order.verify(storeOwnerRepository).save(savedCaptor.capture());
        order.verify(userRepository).deleteById(5L);
        assertThat(savedCaptor.getValue().getOwner()).isNull();
        assertThat(savedCaptor.getValue().isActive()).isFalse();
        verify(userRepository, never()).getReferenceById(any(Long.class));
        verify(storeOwnerRepository, never()).deleteById(any());
        verify(storeRepository, never()).deleteById(any());
    }
}
