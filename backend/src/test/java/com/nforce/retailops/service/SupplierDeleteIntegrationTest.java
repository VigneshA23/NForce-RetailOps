package com.nforce.retailops.service;

import com.nforce.retailops.dto.SupplierDeleteResponse;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SupplierRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

// Runs deleteSupplier against a real database: the mocked SupplierServiceTest
// can't catch a bulk-update / delete interaction that fails at flush time.
@SpringBootTest
@ActiveProfiles("test")
class SupplierDeleteIntegrationTest {

    @Autowired private SupplierService supplierService;
    @Autowired private SupplierRepository supplierRepository;
    @Autowired private StoreInventoryItemRepository storeInventoryItemRepository;
    @Autowired private StoreRepository storeRepository;

    @Test
    @Transactional
    void deletingSupplierClearsItemsAndRemovesRow() {
        Store store = new Store();
        store.setName("Delete test store");
        store.setStoreCode(9_900L);
        store.setActive(true);
        store = storeRepository.save(store);

        Supplier supplier = new Supplier();
        supplier.setName("ghg");
        supplier = supplierRepository.save(supplier);

        StoreInventoryItem item = new StoreInventoryItem();
        item.setStore(store);
        item.setName("Milk");
        item.setUnitOfMeasurement("EA");
        item.setActive(true);
        item.setPreferredSupplier(supplier);
        item = storeInventoryItemRepository.save(item);

        SupplierDeleteResponse response = supplierService.deleteSupplier(supplier.getId());
        storeInventoryItemRepository.flush();

        assertThat(response.deleted()).isTrue();
        assertThat(supplierRepository.findById(supplier.getId())).isEmpty();
        assertThat(storeInventoryItemRepository.findById(item.getId()).orElseThrow().getPreferredSupplier()).isNull();
    }
}
