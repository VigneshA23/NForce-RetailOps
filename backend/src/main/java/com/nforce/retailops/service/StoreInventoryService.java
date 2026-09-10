package com.nforce.retailops.service;

import com.nforce.retailops.dto.StoreInventoryItemConfigRequest;
import com.nforce.retailops.dto.StoreInventoryItemResponse;
import com.nforce.retailops.entity.StoreInventoryItem;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.exception.StoreInventoryItemNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.exception.SupplierNotFoundException;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.SupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

// Owner/Admin's Phase 2 store-inventory configuration: list the items
// already assigned (by Super Admin) to their one store, and update the
// min-stock thresholds + preferred supplier on each -- never create/delete
// the assignment itself.
@Service
public class StoreInventoryService {

    private final StoreInventoryItemRepository storeInventoryItemRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final SupplierRepository supplierRepository;

    public StoreInventoryService(
        StoreInventoryItemRepository storeInventoryItemRepository,
        StoreOwnerRepository storeOwnerRepository,
        SupplierRepository supplierRepository
    ) {
        this.storeInventoryItemRepository = storeInventoryItemRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.supplierRepository = supplierRepository;
    }

    private StoreOwner requireActiveStoreOwner(Long ownerId) {
        return storeOwnerRepository.findByOwnerIdAndActiveTrue(ownerId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
    }

    @Transactional(readOnly = true)
    public List<StoreInventoryItemResponse> listStoreItems(Long ownerId) {
        StoreOwner storeOwner = requireActiveStoreOwner(ownerId);
        return storeInventoryItemRepository.findByStoreIdOrderById(storeOwner.getStore().getId()).stream()
            .map(StoreInventoryItemResponse::from)
            .toList();
    }

    @Transactional
    public StoreInventoryItemResponse updateConfig(Long ownerId, Long storeInventoryItemId, StoreInventoryItemConfigRequest request) {
        StoreOwner storeOwner = requireActiveStoreOwner(ownerId);

        StoreInventoryItem item = storeInventoryItemRepository
            .findByIdAndStoreId(storeInventoryItemId, storeOwner.getStore().getId())
            .orElseThrow(() -> new StoreInventoryItemNotFoundException("Store inventory item not found"));

        item.setMinWeekday(request.minWeekday());
        item.setMinWeekend(request.minWeekend());

        if (request.preferredSupplierId() == null) {
            item.setPreferredSupplier(null);
        } else {
            Supplier supplier = supplierRepository.findById(request.preferredSupplierId())
                .orElseThrow(() -> new SupplierNotFoundException("Supplier not found"));
            item.setPreferredSupplier(supplier);
        }

        item = storeInventoryItemRepository.save(item);
        return StoreInventoryItemResponse.from(item);
    }
}
