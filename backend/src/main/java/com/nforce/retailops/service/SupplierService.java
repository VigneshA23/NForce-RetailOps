package com.nforce.retailops.service;

import com.nforce.retailops.dto.SupplierDeleteResponse;
import com.nforce.retailops.dto.SupplierRequest;
import com.nforce.retailops.dto.SupplierResponse;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.exception.SupplierNotFoundException;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.SupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SupplierService {

    private final SupplierRepository supplierRepository;
    private final StoreInventoryItemRepository storeInventoryItemRepository;
    private final OrderListEntryRepository orderListEntryRepository;

    public SupplierService(
        SupplierRepository supplierRepository,
        StoreInventoryItemRepository storeInventoryItemRepository,
        OrderListEntryRepository orderListEntryRepository
    ) {
        this.supplierRepository = supplierRepository;
        this.storeInventoryItemRepository = storeInventoryItemRepository;
        this.orderListEntryRepository = orderListEntryRepository;
    }

    @Transactional(readOnly = true)
    public List<SupplierResponse> listSuppliers() {
        return supplierRepository.findAllByOrderByNameAsc().stream()
            .map(SupplierResponse::from)
            .toList();
    }

    @Transactional
    public SupplierResponse createSupplier(SupplierRequest request) {
        Supplier supplier = new Supplier();
        supplier.setName(request.name().trim());
        supplier = supplierRepository.save(supplier);
        return SupplierResponse.from(supplier);
    }

    // Backs the inline "Add New Supplier" option in the inventory item form.
    // suppliers.name has no unique constraint, so reuse an existing supplier
    // with the same name (case-insensitive) rather than creating a duplicate,
    // reactivating it if it had been deactivated.
    @Transactional
    public SupplierResponse findOrCreateSupplier(SupplierRequest request) {
        String name = request.name().trim();
        Supplier supplier = supplierRepository.findFirstByNameIgnoreCaseOrderByIdAsc(name)
            .map(existing -> {
                if (!existing.isActive()) {
                    existing.setActive(true);
                    return supplierRepository.save(existing);
                }
                return existing;
            })
            .orElseGet(() -> {
                Supplier created = new Supplier();
                created.setName(name);
                return supplierRepository.save(created);
            });
        return SupplierResponse.from(supplier);
    }

    @Transactional
    public SupplierResponse updateSupplier(Long supplierId, SupplierRequest request) {
        Supplier supplier = supplierRepository.findById(supplierId)
            .orElseThrow(() -> new SupplierNotFoundException("Supplier not found"));
        supplier.setName(request.name().trim());
        supplier = supplierRepository.save(supplier);
        return SupplierResponse.from(supplier);
    }

    @Transactional
    public SupplierResponse setSupplierActive(Long supplierId, boolean active) {
        Supplier supplier = supplierRepository.findById(supplierId)
            .orElseThrow(() -> new SupplierNotFoundException("Supplier not found"));
        supplier.setActive(active);
        supplier = supplierRepository.save(supplier);
        return SupplierResponse.from(supplier);
    }

    // Items that preferred this supplier fall back to "no preferred supplier"
    // either way. A supplier with order history is only deactivated, so past
    // orders and purchasing reports keep their supplier; with none, the row
    // is removed outright.
    @Transactional
    public SupplierDeleteResponse deleteSupplier(Long supplierId) {
        Supplier supplier = supplierRepository.findById(supplierId)
            .orElseThrow(() -> new SupplierNotFoundException("Supplier not found"));
        storeInventoryItemRepository.clearPreferredSupplier(supplierId);
        if (orderListEntryRepository.existsBySupplierId(supplierId)) {
            supplier.setActive(false);
            supplierRepository.save(supplier);
            return new SupplierDeleteResponse(false, true);
        }
        supplierRepository.delete(supplier);
        return new SupplierDeleteResponse(true, false);
    }
}
