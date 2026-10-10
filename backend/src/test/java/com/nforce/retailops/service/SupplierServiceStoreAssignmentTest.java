package com.nforce.retailops.service;

import com.nforce.retailops.dto.SupplierDetailsRequest;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.exception.InvalidStoreSelectionException;
import com.nforce.retailops.exception.StoreInactiveException;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SupplierRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SupplierServiceStoreAssignmentTest {

    private static final Long STORE_ID = 10L;
    private static final Long OTHER_STORE_ID = 20L;

    @Mock private SupplierRepository supplierRepository;
    @Mock private StoreInventoryItemRepository storeInventoryItemRepository;
    @Mock private OrderListEntryRepository orderListEntryRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private StoreOwnerRepository storeOwnerRepository;

    @InjectMocks
    private SupplierService supplierService;

    private Store store(long id, boolean active) {
        Store store = new Store();
        ReflectionTestUtils.setField(store, "id", id);
        store.setName("Store " + id);
        store.setActive(active);
        return store;
    }

    @BeforeEach
    void setUp() {
        lenient().when(supplierRepository.save(any(Supplier.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void appliesToAllStoresLeavesTheAssignedStoreSetEmpty() {
        when(supplierRepository.existsByNameIgnoreCase("Walmart")).thenReturn(false);

        SupplierDetailsRequest request = new SupplierDetailsRequest("Walmart", null, null, true, List.of());
        var response = supplierService.createSupplierWithDetails(request);

        assertThat(response.appliesToAllStores()).isTrue();
        assertThat(response.stores()).isEmpty();
    }

    @Test
    void specificStoreSelectionIsResolvedAndStored() {
        Store storeA = store(STORE_ID, true);
        when(supplierRepository.existsByNameIgnoreCase("Walmart")).thenReturn(false);
        when(storeRepository.findAllById(List.of(STORE_ID))).thenReturn(List.of(storeA));

        SupplierDetailsRequest request = new SupplierDetailsRequest("Walmart", null, null, false, List.of(STORE_ID));
        var response = supplierService.createSupplierWithDetails(request);

        assertThat(response.appliesToAllStores()).isFalse();
        assertThat(response.stores()).extracting("id").containsExactly(STORE_ID);
    }

    @Test
    void emptySelectionWithoutAllStoresIsRejected() {
        when(supplierRepository.existsByNameIgnoreCase("Walmart")).thenReturn(false);

        SupplierDetailsRequest request = new SupplierDetailsRequest("Walmart", null, null, false, List.of());

        assertThatThrownBy(() -> supplierService.createSupplierWithDetails(request))
            .isInstanceOf(InvalidStoreSelectionException.class);
    }

    @Test
    void assigningAStoreThatDoesNotExistIsRejected() {
        when(supplierRepository.existsByNameIgnoreCase("Walmart")).thenReturn(false);
        when(storeRepository.findAllById(List.of(STORE_ID))).thenReturn(List.of());

        SupplierDetailsRequest request = new SupplierDetailsRequest("Walmart", null, null, false, List.of(STORE_ID));

        assertThatThrownBy(() -> supplierService.createSupplierWithDetails(request))
            .isInstanceOf(InvalidStoreSelectionException.class);
    }

    @Test
    void assigningADeactivatedStoreIsRejected() {
        Store inactiveStore = store(STORE_ID, false);
        when(supplierRepository.existsByNameIgnoreCase("Walmart")).thenReturn(false);
        when(storeRepository.findAllById(List.of(STORE_ID))).thenReturn(List.of(inactiveStore));

        SupplierDetailsRequest request = new SupplierDetailsRequest("Walmart", null, null, false, List.of(STORE_ID));

        assertThatThrownBy(() -> supplierService.createSupplierWithDetails(request))
            .isInstanceOf(StoreInactiveException.class);
    }

    @Test
    void multipleStoresCanBeAssignedToOneSupplier() {
        Store storeA = store(STORE_ID, true);
        Store storeB = store(OTHER_STORE_ID, true);
        when(supplierRepository.existsByNameIgnoreCase("Walmart")).thenReturn(false);
        when(storeRepository.findAllById(List.of(STORE_ID, OTHER_STORE_ID))).thenReturn(List.of(storeA, storeB));

        SupplierDetailsRequest request = new SupplierDetailsRequest("Walmart", null, null, false, List.of(STORE_ID, OTHER_STORE_ID));
        var response = supplierService.createSupplierWithDetails(request);

        assertThat(response.stores()).extracting("id").containsExactlyInAnyOrder(STORE_ID, OTHER_STORE_ID);
    }
}
