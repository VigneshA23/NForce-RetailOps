package com.nforce.retailops.service;

import com.nforce.retailops.dto.AssignStoreRequest;
import com.nforce.retailops.dto.OwnerResponse;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.OwnerStoreConflictException;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OwnerManagementServiceTest {

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

    private OwnerManagementService ownerManagementService;

    @BeforeEach
    void setUp() {
        ownerManagementService = new OwnerManagementService(
            userRepository, storeRepository, storeOwnerRepository,
            mailService, storeCodeGenerator, ownerProvisioningService
        );
    }

    private User user(Long id, String fullName) {
        User user = new User();
        ReflectionTestUtils.setField(user, "id", id);
        user.setFullName(fullName);
        user.setEmail(fullName.toLowerCase().replace(" ", ".") + "@nforce.test");
        return user;
    }

    private Store store(Long id, String name) {
        Store store = new Store();
        ReflectionTestUtils.setField(store, "id", id);
        store.setName(name);
        store.setStoreCode(id);
        return store;
    }

    private StoreOwner storeOwner(User owner, Store store) {
        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setOwner(owner);
        storeOwner.setStore(store);
        return storeOwner;
    }

    // Regression test for the N+1 fix: listOwners must fetch every owner's stores
    // in one batched query, not once per owner.
    @Test
    void listOwnersFetchesStoresInOneBatchedQueryNotOncePerOwner() {
        User ownerWithNoStore = user(1L, "Alice Owner");
        User ownerWithStores = user(2L, "Bob Owner");
        when(userRepository.findAllOwners()).thenReturn(List.of(ownerWithNoStore, ownerWithStores));

        Store storeA = store(10L, "Downtown");
        Store storeB = store(11L, "Uptown");
        when(storeOwnerRepository.findByOwnerIdInWithStoreAndOwner(List.of(1L, 2L)))
            .thenReturn(List.of(storeOwner(ownerWithStores, storeA), storeOwner(ownerWithStores, storeB)));

        List<OwnerResponse> result = ownerManagementService.listOwners();

        assertThat(result).hasSize(3);
        assertThat(result.get(0).ownerId()).isEqualTo(1L);
        assertThat(result.get(0).storeId()).isNull();
        assertThat(result.get(1).ownerId()).isEqualTo(2L);
        assertThat(result.get(1).storeId()).isEqualTo(10L);
        assertThat(result.get(2).ownerId()).isEqualTo(2L);
        assertThat(result.get(2).storeId()).isEqualTo(11L);

        verify(storeOwnerRepository, times(1)).findByOwnerIdInWithStoreAndOwner(List.of(1L, 2L));
    }

    @Test
    void assignStoreThrowsConflictWhenOwnerAlreadyHasActiveStore() {
        User owner = user(1L, "Alice Owner");
        when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(storeOwnerRepository.existsByOwnerIdAndActiveTrue(1L)).thenReturn(true);

        assertThatThrownBy(() -> ownerManagementService.assignStore(1L, new AssignStoreRequest("New Store", "Main St")))
            .isInstanceOf(OwnerStoreConflictException.class)
            .hasMessageContaining("active store assigned");
    }

    @Test
    void assignStoreSucceedsWhenOwnerHasNoActiveStore() {
        User owner = user(1L, "Alice Owner");
        when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(storeOwnerRepository.existsByOwnerIdAndActiveTrue(1L)).thenReturn(false);
        when(storeCodeGenerator.next()).thenReturn(300L);
        when(storeRepository.save(any(Store.class))).thenAnswer(invocation -> {
            Store s = invocation.getArgument(0);
            ReflectionTestUtils.setField(s, "id", 20L);
            return s;
        });
        when(storeOwnerRepository.save(any(StoreOwner.class))).thenAnswer(invocation -> invocation.getArgument(0));

        OwnerResponse response = ownerManagementService.assignStore(1L, new AssignStoreRequest("New Store", "Main St"));

        assertThat(response.ownerId()).isEqualTo(1L);
        assertThat(response.storeId()).isEqualTo(20L);
        assertThat(response.storeName()).isEqualTo("New Store");
    }

    // Regression test for the unbounded-listing fix: the response is capped at
    // MAX_OWNER_LISTING_ROWS rather than growing unbounded with the platform.
    @Test
    void listOwnersTruncatesAtFiveHundredRows() {
        List<User> owners = new ArrayList<>();
        for (long id = 1; id <= 501; id++) {
            owners.add(user(id, "Owner " + id));
        }
        when(userRepository.findAllOwners()).thenReturn(owners);
        List<Long> ownerIds = owners.stream().map(User::getId).toList();
        when(storeOwnerRepository.findByOwnerIdInWithStoreAndOwner(ownerIds)).thenReturn(List.of());

        List<OwnerResponse> result = ownerManagementService.listOwners();

        assertThat(result).hasSize(500);
    }
}
