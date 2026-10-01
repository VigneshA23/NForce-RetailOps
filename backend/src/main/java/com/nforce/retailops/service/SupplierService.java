package com.nforce.retailops.service;

import com.nforce.retailops.dto.SupplierRequest;
import com.nforce.retailops.dto.SupplierResponse;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.exception.SupplierNotFoundException;
import com.nforce.retailops.repository.SupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SupplierService {

    private final SupplierRepository supplierRepository;

    public SupplierService(SupplierRepository supplierRepository) {
        this.supplierRepository = supplierRepository;
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
}
