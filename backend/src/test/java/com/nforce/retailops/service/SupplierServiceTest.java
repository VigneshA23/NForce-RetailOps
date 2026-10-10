package com.nforce.retailops.service;

import com.nforce.retailops.dto.SupplierDeleteResponse;
import com.nforce.retailops.dto.SupplierDetailsRequest;
import com.nforce.retailops.dto.SupplierResponse;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.exception.SupplierNotFoundException;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SupplierRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SupplierServiceTest {

    @Mock private SupplierRepository supplierRepository;
    @Mock private StoreInventoryItemRepository storeInventoryItemRepository;
    @Mock private OrderListEntryRepository orderListEntryRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private StoreOwnerRepository storeOwnerRepository;
    @InjectMocks private SupplierService supplierService;

    @Test
    void deleteWithoutOrderHistoryRemovesSupplierAndClearsItems() {
        Supplier supplier = new Supplier();
        when(supplierRepository.findById(5L)).thenReturn(Optional.of(supplier));
        when(orderListEntryRepository.existsBySupplierId(5L)).thenReturn(false);

        SupplierDeleteResponse response = supplierService.deleteSupplier(5L);

        assertTrue(response.deleted());
        assertFalse(response.deactivated());
        verify(storeInventoryItemRepository).clearPreferredSupplier(5L);
        verify(supplierRepository).delete(supplier);
    }

    @Test
    void deleteWithOrderHistoryOnlyDeactivatesSupplierAndClearsItems() {
        Supplier supplier = new Supplier();
        when(supplierRepository.findById(5L)).thenReturn(Optional.of(supplier));
        when(orderListEntryRepository.existsBySupplierId(5L)).thenReturn(true);

        SupplierDeleteResponse response = supplierService.deleteSupplier(5L);

        assertFalse(response.deleted());
        assertTrue(response.deactivated());
        assertFalse(supplier.isActive());
        verify(storeInventoryItemRepository).clearPreferredSupplier(5L);
        verify(supplierRepository, never()).delete(supplier);
    }

    @Test
    void deleteUnknownSupplierThrowsNotFound() {
        when(supplierRepository.findById(9L)).thenReturn(Optional.empty());
        assertThrows(SupplierNotFoundException.class, () -> supplierService.deleteSupplier(9L));
    }

    @Test
    void createWithDetailsStoresContactAndLocationAndDefaultsToAllStores() {
        when(supplierRepository.existsByNameIgnoreCase("Walmart")).thenReturn(false);
        when(supplierRepository.save(any(Supplier.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SupplierDetailsRequest request = new SupplierDetailsRequest("Walmart", "+1 2025551234", "Downtown", true, List.of());
        SupplierResponse response = supplierService.createSupplierWithDetails(request);

        assertEquals("+1 2025551234", response.contact());
        assertEquals("Downtown", response.location());
        assertTrue(response.appliesToAllStores());
        assertTrue(response.stores().isEmpty());
    }

    @Test
    void createWithDetailsTreatsBlankContactAndLocationAsNull() {
        when(supplierRepository.existsByNameIgnoreCase("Walmart")).thenReturn(false);
        when(supplierRepository.save(any(Supplier.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SupplierDetailsRequest request = new SupplierDetailsRequest("Walmart", "  ", "", true, List.of());
        SupplierResponse response = supplierService.createSupplierWithDetails(request);

        assertNull(response.contact());
        assertNull(response.location());
    }

    @Test
    void updateWithDetailsRequiresAtLeastOneStoreWhenNotAllStores() {
        Supplier supplier = new Supplier();
        when(supplierRepository.findById(5L)).thenReturn(Optional.of(supplier));
        when(supplierRepository.existsByNameIgnoreCaseAndIdNot("Walmart", 5L)).thenReturn(false);

        SupplierDetailsRequest request = new SupplierDetailsRequest("Walmart", null, null, false, List.of());

        assertThrows(
            com.nforce.retailops.exception.InvalidStoreSelectionException.class,
            () -> supplierService.updateSupplierWithDetails(5L, request)
        );
    }

    @Test
    void listSuppliersForStoreExcludesOnlySuppliersHiddenAtThatStore() {
        com.nforce.retailops.entity.Store myStore = new com.nforce.retailops.entity.Store();
        org.springframework.test.util.ReflectionTestUtils.setField(myStore, "id", 10L);
        com.nforce.retailops.entity.Store otherStore = new com.nforce.retailops.entity.Store();
        org.springframework.test.util.ReflectionTestUtils.setField(otherStore, "id", 20L);

        com.nforce.retailops.entity.StoreOwner link = new com.nforce.retailops.entity.StoreOwner();
        link.setStore(myStore);
        link.setActive(true);
        when(storeOwnerRepository.findByOwnerId(1L)).thenReturn(List.of(link));

        Supplier hiddenHere = new Supplier();
        hiddenHere.setName("Hidden Here");
        hiddenHere.getHiddenAtStores().add(myStore);

        Supplier hiddenElsewhere = new Supplier();
        hiddenElsewhere.setName("Hidden Elsewhere");
        hiddenElsewhere.getHiddenAtStores().add(otherStore);

        Supplier visible = new Supplier();
        visible.setName("Visible");

        when(supplierRepository.findAllByOrderByNameAsc()).thenReturn(List.of(hiddenHere, hiddenElsewhere, visible));

        List<SupplierResponse> result = supplierService.listSuppliersForStore(1L);

        assertEquals(2, result.size());
        assertTrue(result.stream().anyMatch(r -> r.name().equals("Hidden Elsewhere")));
        assertTrue(result.stream().anyMatch(r -> r.name().equals("Visible")));
    }

    @Test
    void hideSupplierForStoreAddsOnlyThatStoreToHiddenSet() {
        com.nforce.retailops.entity.Store myStore = new com.nforce.retailops.entity.Store();
        org.springframework.test.util.ReflectionTestUtils.setField(myStore, "id", 10L);

        com.nforce.retailops.entity.StoreOwner link = new com.nforce.retailops.entity.StoreOwner();
        link.setStore(myStore);
        link.setActive(true);
        when(storeOwnerRepository.findByOwnerId(1L)).thenReturn(List.of(link));

        Supplier supplier = new Supplier();
        when(supplierRepository.findById(7L)).thenReturn(Optional.of(supplier));
        when(supplierRepository.save(any(Supplier.class))).thenAnswer(invocation -> invocation.getArgument(0));

        supplierService.hideSupplierForStore(1L, 7L);

        assertTrue(supplier.getHiddenAtStores().contains(myStore));
        verify(supplierRepository).save(supplier);
    }

    @Test
    void hideSupplierForUnknownOwnerStoreThrowsNotFound() {
        when(storeOwnerRepository.findByOwnerId(99L)).thenReturn(List.of());

        assertThrows(
            com.nforce.retailops.exception.StoreNotFoundException.class,
            () -> supplierService.hideSupplierForStore(99L, 7L)
        );
    }
}
