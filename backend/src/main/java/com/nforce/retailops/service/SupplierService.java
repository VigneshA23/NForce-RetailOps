package com.nforce.retailops.service;

import com.nforce.retailops.dto.SupplierDeleteResponse;
import com.nforce.retailops.dto.SupplierDetailsRequest;
import com.nforce.retailops.dto.SupplierRequest;
import com.nforce.retailops.dto.SupplierResponse;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.exception.InvalidStoreSelectionException;
import com.nforce.retailops.exception.StoreInactiveException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.exception.SupplierNameExistsException;
import com.nforce.retailops.exception.SupplierNotFoundException;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.StoreInventoryItemRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.StoreRepository;
import com.nforce.retailops.repository.SupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class SupplierService {

    private final SupplierRepository supplierRepository;
    private final StoreInventoryItemRepository storeInventoryItemRepository;
    private final OrderListEntryRepository orderListEntryRepository;
    private final StoreRepository storeRepository;
    private final StoreOwnerRepository storeOwnerRepository;

    public SupplierService(
        SupplierRepository supplierRepository,
        StoreInventoryItemRepository storeInventoryItemRepository,
        OrderListEntryRepository orderListEntryRepository,
        StoreRepository storeRepository,
        StoreOwnerRepository storeOwnerRepository
    ) {
        this.supplierRepository = supplierRepository;
        this.storeInventoryItemRepository = storeInventoryItemRepository;
        this.orderListEntryRepository = orderListEntryRepository;
        this.storeRepository = storeRepository;
        this.storeOwnerRepository = storeOwnerRepository;
    }

    @Transactional(readOnly = true)
    public List<SupplierResponse> listSuppliers() {
        return supplierRepository.findAllByOrderByNameAsc().stream()
            .map(SupplierResponse::from)
            .toList();
    }

    // Owner/Admin's own Suppliers tab + the inventory item form's preferred-
    // supplier dropdown (both consume this one endpoint) -- excludes whatever
    // this store has chosen to hide, without touching the global list other
    // stores or Super Admin see.
    @Transactional(readOnly = true)
    public List<SupplierResponse> listSuppliersForStore(Long ownerId) {
        Store store = requireOwnerStore(ownerId);
        return supplierRepository.findAllByOrderByNameAsc().stream()
            .filter(supplier -> supplier.getHiddenAtStores().stream().noneMatch(s -> s.getId().equals(store.getId())))
            .map(SupplierResponse::from)
            .toList();
    }

    // "Remove from my store" (distinct from Super Admin/global deleteSupplier
    // above) -- hides the supplier from this store's own lists only; the
    // supplier row itself, and every other store's view of it, is untouched.
    @Transactional
    public void hideSupplierForStore(Long ownerId, Long supplierId) {
        Store store = requireOwnerStore(ownerId);
        Supplier supplier = supplierRepository.findById(supplierId)
            .orElseThrow(() -> new SupplierNotFoundException("Supplier not found"));
        supplier.getHiddenAtStores().add(store);
        supplierRepository.save(supplier);
    }

    private Store requireOwnerStore(Long ownerId) {
        return storeOwnerRepository.findByOwnerId(ownerId).stream()
            .filter(StoreOwner::isActive)
            .findFirst()
            .map(StoreOwner::getStore)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
    }

    @Transactional
    public SupplierResponse createSupplier(SupplierRequest request) {
        String name = request.name().trim();
        if (supplierRepository.existsByNameIgnoreCase(name)) {
            throw new SupplierNameExistsException("A supplier with this name already exists.");
        }
        Supplier supplier = new Supplier();
        supplier.setName(name);
        supplier = supplierRepository.save(supplier);
        return SupplierResponse.from(supplier);
    }

    // Super Admin's own Add Supplier form only (RTS-304 follow-up) -- Owner/
    // Admin's rename-only flow keeps using createSupplier/updateSupplier
    // above via SupplierRequest, so it's never subject to the store-selection
    // validation below.
    @Transactional
    public SupplierResponse createSupplierWithDetails(SupplierDetailsRequest request) {
        String name = request.name().trim();
        if (supplierRepository.existsByNameIgnoreCase(name)) {
            throw new SupplierNameExistsException("A supplier with this name already exists.");
        }
        Supplier supplier = new Supplier();
        supplier.setName(name);
        applyDetails(supplier, request);
        supplier = supplierRepository.save(supplier);
        return SupplierResponse.from(supplier);
    }

    @Transactional
    public SupplierResponse updateSupplierWithDetails(Long supplierId, SupplierDetailsRequest request) {
        Supplier supplier = supplierRepository.findById(supplierId)
            .orElseThrow(() -> new SupplierNotFoundException("Supplier not found"));
        String name = request.name().trim();
        if (supplierRepository.existsByNameIgnoreCaseAndIdNot(name, supplierId)) {
            throw new SupplierNameExistsException("A supplier with this name already exists.");
        }
        supplier.setName(name);
        applyDetails(supplier, request);
        supplier = supplierRepository.save(supplier);
        return SupplierResponse.from(supplier);
    }

    private void applyDetails(Supplier supplier, SupplierDetailsRequest request) {
        supplier.setContact(blankToNull(request.contact()));
        supplier.setLocation(blankToNull(request.location()));
        supplier.setAppliesToAllStores(request.appliesToAllStores());
        supplier.setStores(resolveAnyStores(request.appliesToAllStores(), request.storeIds()));
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Set<Store> resolveAnyStores(boolean appliesToAllStores, List<Long> storeIds) {
        if (appliesToAllStores) {
            return new HashSet<>();
        }
        List<Long> ids = storeIds == null ? List.of() : storeIds;
        if (ids.isEmpty()) {
            throw new InvalidStoreSelectionException("Select at least one store, or choose All Stores");
        }
        List<Store> stores = storeRepository.findAllById(ids);
        if (stores.size() != Set.copyOf(ids).size()) {
            throw new InvalidStoreSelectionException("One or more selected stores could not be found");
        }
        if (stores.stream().anyMatch(s -> !s.isActive())) {
            throw new StoreInactiveException("One or more selected stores have been deactivated");
        }
        return new HashSet<>(stores);
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
        String name = request.name().trim();
        if (supplierRepository.existsByNameIgnoreCaseAndIdNot(name, supplierId)) {
            throw new SupplierNameExistsException("A supplier with this name already exists.");
        }
        supplier.setName(name);
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
