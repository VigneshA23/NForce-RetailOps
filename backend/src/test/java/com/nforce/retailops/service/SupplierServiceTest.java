package com.nforce.retailops.service;

import com.nforce.retailops.dto.SupplierDeleteResponse;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.exception.SupplierNotFoundException;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.SupplierRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SupplierServiceTest {

    @Mock private SupplierRepository supplierRepository;
    @Mock private StoreInventoryItemRepository storeInventoryItemRepository;
    @Mock private OrderListEntryRepository orderListEntryRepository;
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
}
