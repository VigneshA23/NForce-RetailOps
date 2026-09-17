package com.nforce.retailops.service;

import com.nforce.retailops.dto.SuperAdminStoreResponse;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.repository.StoreEmployeeRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.TaskRepository;
import com.nforce.retailops.repository.TaskResponseEntryRepository;
import com.nforce.retailops.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StoreServiceTest {

    @Mock
    private StoreRepository storeRepository;
    @Mock
    private StoreOwnerRepository storeOwnerRepository;
    @Mock
    private StoreEmployeeRepository storeEmployeeRepository;
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private TaskResponseEntryRepository taskResponseEntryRepository;
    @Mock
    private StoreCodeGenerator storeCodeGenerator;
    @Mock
    private NotificationService notificationService;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private StoreService storeService;

    private Store storeWithId(long id, String name) {
        Store store = new Store();
        ReflectionTestUtils.setField(store, "id", id);
        ReflectionTestUtils.setField(store, "name", name);
        ReflectionTestUtils.setField(store, "active", true);
        return store;
    }

    // Regression test for the "Total Stores" undercount bug: a store with no
    // corresponding StoreOwner row at all (as opposed to a StoreOwner row with
    // a null owner) must still be included in the Super Admin's cross-owner
    // store directory, not silently dropped.
    @Test
    void listAllStoresForSuperAdminIncludesAStoreWithNoStoreOwnerRow() {
        Store ownedStore = storeWithId(1L, "Owned Store");
        StoreOwner storeOwner = new StoreOwner();
        storeOwner.setStore(ownedStore);
        User owner = new User();
        ReflectionTestUtils.setField(owner, "id", 100L);
        owner.setFullName("Jane Owner");
        owner.setActive(true);
        storeOwner.setOwner(owner);
        storeOwner.setActive(true);

        Store unlinkedStore = storeWithId(2L, "Unlinked Store");

        when(storeRepository.findAllWithOptionalStoreOwner()).thenReturn(List.of(
            new Object[] { ownedStore, storeOwner, owner },
            new Object[] { unlinkedStore, null, null }
        ));
        when(storeEmployeeRepository.countActiveGroupedByStoreIds(anyCollection())).thenReturn(List.of());
        when(taskRepository.countGroupedByStoreIds(anyCollection())).thenReturn(List.of());
        when(taskRepository.countAppliesToAllGroupedByOwnerIds(anyCollection())).thenReturn(List.of());

        List<SuperAdminStoreResponse> result = storeService.listAllStoresForSuperAdmin();

        assertThat(result).hasSize(2);
        assertThat(result).extracting(SuperAdminStoreResponse::storeName)
            .containsExactlyInAnyOrder("Owned Store", "Unlinked Store");

        SuperAdminStoreResponse unlinked = result.stream()
            .filter(r -> r.storeName().equals("Unlinked Store"))
            .findFirst().orElseThrow();
        assertThat(unlinked.ownerId()).isNull();
        assertThat(unlinked.ownerName()).isNull();
        assertThat(unlinked.ownerAccessActive()).isFalse();
    }
}
