package com.nforce.retailops.service;

import com.nforce.retailops.dto.SupplierRequest;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.exception.SupplierNotManagedByStoreException;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Owner-scope rules the HTTP test (StoreSupplierOwnershipTest) can't cheaply
// set up: another store's order history makes a supplier shared.
@ExtendWith(MockitoExtension.class)
class SupplierServiceOwnerScopeTest {

    private static final Long OWNER_ID = 1L;
    private static final Long STORE_ID = 10L;
    private static final Long SUPPLIER_ID = 5L;

    @Mock private SupplierRepository supplierRepository;
    @Mock private StoreInventoryItemRepository storeInventoryItemRepository;
    @Mock private OrderListEntryRepository orderListEntryRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private StoreOwnerRepository storeOwnerRepository;

    @InjectMocks private SupplierService supplierService;

    private Supplier supplier;

    @BeforeEach
    void setUp() {
        Store store = new Store();
        ReflectionTestUtils.setField(store, "id", STORE_ID);
        StoreOwner link = new StoreOwner();
        link.setStore(store);
        lenient().when(storeOwnerRepository.findByOwnerId(OWNER_ID)).thenReturn(List.of(link));

        supplier = new Supplier();
        ReflectionTestUtils.setField(supplier, "id", SUPPLIER_ID);
        supplier.setName("Only Ours By Assignment");
        supplier.getStores().add(store);
        lenient().when(supplierRepository.findById(SUPPLIER_ID)).thenReturn(Optional.of(supplier));
    }

    @Test
    void anotherStoresOrderHistoryMakesTheSupplierShared() {
        when(storeInventoryItemRepository.existsByPreferredSupplierIdAndStoreIdNot(SUPPLIER_ID, STORE_ID)).thenReturn(false);
        when(orderListEntryRepository.existsBySupplierIdAndStoreIdNot(SUPPLIER_ID, STORE_ID)).thenReturn(true);

        assertThatThrownBy(() -> supplierService.deleteSupplierForOwner(OWNER_ID, SUPPLIER_ID))
            .isInstanceOf(SupplierNotManagedByStoreException.class);
        assertThatThrownBy(() -> supplierService.updateSupplierForOwner(OWNER_ID, SUPPLIER_ID, new SupplierRequest("X", null)))
            .isInstanceOf(SupplierNotManagedByStoreException.class);

        verify(storeInventoryItemRepository, never()).clearPreferredSupplierForStore(anyLong(), anyLong());
        verify(storeInventoryItemRepository, never()).clearPreferredSupplier(anyLong());
        verify(supplierRepository, never()).save(any());
        verify(supplierRepository, never()).delete(any());
    }

    @Test
    void ownerDeleteNeverUsesThePlatformWideClear() {
        when(storeInventoryItemRepository.existsByPreferredSupplierIdAndStoreIdNot(SUPPLIER_ID, STORE_ID)).thenReturn(false);
        when(orderListEntryRepository.existsBySupplierIdAndStoreIdNot(SUPPLIER_ID, STORE_ID)).thenReturn(false);
        when(orderListEntryRepository.existsBySupplierId(SUPPLIER_ID)).thenReturn(false);

        supplierService.deleteSupplierForOwner(OWNER_ID, SUPPLIER_ID);

        verify(storeInventoryItemRepository).clearPreferredSupplierForStore(SUPPLIER_ID, STORE_ID);
        verify(storeInventoryItemRepository, never()).clearPreferredSupplier(anyLong());
        verify(supplierRepository).delete(supplier);
    }

    @Test
    void ownerWithoutAnActiveStoreIsRejected() {
        when(storeOwnerRepository.findByOwnerId(2L)).thenReturn(List.of());

        assertThatThrownBy(() -> supplierService.setSupplierActiveForOwner(2L, SUPPLIER_ID, false))
            .isInstanceOf(StoreNotFoundException.class);
    }
}
