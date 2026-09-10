package com.nforce.retailops.service;

import com.nforce.retailops.dto.OrderListEntryResponse;
import com.nforce.retailops.dto.UpdateOrderListEntryRequest;
import com.nforce.retailops.entity.InventoryItem;
import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.OrderStatus;
import com.nforce.retailops.entity.Store;
import com.nforce.retailops.entity.StoreOwner;
import com.nforce.retailops.entity.Supplier;
import com.nforce.retailops.entity.User;
import com.nforce.retailops.exception.OrderListEntryNotFoundException;
import com.nforce.retailops.exception.StoreNotFoundException;
import com.nforce.retailops.exception.SupplierNotFoundException;
import com.nforce.retailops.repository.OrderListEntryRepository;
import com.nforce.retailops.repository.StoreOwnerRepository;
import com.nforce.retailops.repository.SupplierRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

// Owner/Admin's Order Dashboard, plus the shared "raise or bump a shortage"
// logic used by both the stock-check auto-detection path and the employee
// ad-hoc report path.
@Service
public class OrderListService {

    private final OrderListEntryRepository orderListEntryRepository;
    private final StoreOwnerRepository storeOwnerRepository;
    private final SupplierRepository supplierRepository;

    public OrderListService(
        OrderListEntryRepository orderListEntryRepository,
        StoreOwnerRepository storeOwnerRepository,
        SupplierRepository supplierRepository
    ) {
        this.orderListEntryRepository = orderListEntryRepository;
        this.storeOwnerRepository = storeOwnerRepository;
        this.supplierRepository = supplierRepository;
    }

    private StoreOwner requireActiveStoreOwner(Long ownerId) {
        return storeOwnerRepository.findByOwnerIdAndActiveTrue(ownerId)
            .orElseThrow(() -> new StoreNotFoundException("Store not found"));
    }

    @Transactional(readOnly = true)
    public List<OrderListEntryResponse> listForOwner(Long ownerId) {
        StoreOwner storeOwner = requireActiveStoreOwner(ownerId);
        return orderListEntryRepository.findByStoreIdOrderByCreatedAtDesc(storeOwner.getStore().getId()).stream()
            .map(OrderListEntryResponse::from)
            .toList();
    }

    @Transactional
    public OrderListEntryResponse updateEntry(Long ownerId, Long entryId, UpdateOrderListEntryRequest request) {
        StoreOwner storeOwner = requireActiveStoreOwner(ownerId);

        OrderListEntry entry = orderListEntryRepository.findByIdAndStoreId(entryId, storeOwner.getStore().getId())
            .orElseThrow(() -> new OrderListEntryNotFoundException("Order list entry not found"));

        entry.setQuantityNeeded(request.quantityNeeded());
        entry.setNote(request.note());
        entry.setStatus(request.status());

        if (request.supplierId() == null) {
            entry.setSupplier(null);
        } else {
            Supplier supplier = supplierRepository.findById(request.supplierId())
                .orElseThrow(() -> new SupplierNotFoundException("Supplier not found"));
            entry.setSupplier(supplier);
        }

        entry = orderListEntryRepository.save(entry);
        return OrderListEntryResponse.from(entry);
    }

    // Shared upsert: raises a new shortage or bumps the quantity/note on an
    // already-active entry for the same store+item, rather than creating a
    // duplicate row. The V49 partial unique index
    // (store_id, inventory_item_id) WHERE status <> 'RECEIVED' is the
    // concurrency backstop -- on the rare race where two upserts for the same
    // store+item both miss the find step, the losing insert's constraint
    // violation is caught here and retried as an update against the winner's
    // row instead of surfacing as a raw 500.
    @Transactional
    public void upsertShortage(Store store, InventoryItem item, int quantityNeeded, String note, boolean adHoc, User raisedBy, Supplier defaultSupplier) {
        try {
            doUpsertShortage(store, item, quantityNeeded, note, adHoc, raisedBy, defaultSupplier);
        } catch (DataIntegrityViolationException raceLostInsert) {
            doUpsertShortage(store, item, quantityNeeded, note, adHoc, raisedBy, defaultSupplier);
        }
    }

    private void doUpsertShortage(Store store, InventoryItem item, int quantityNeeded, String note, boolean adHoc, User raisedBy, Supplier defaultSupplier) {
        OrderListEntry entry = orderListEntryRepository
            .findByStoreIdAndInventoryItemIdAndStatusNot(store.getId(), item.getId(), OrderStatus.RECEIVED)
            .orElseGet(() -> {
                OrderListEntry created = new OrderListEntry();
                created.setStore(store);
                created.setInventoryItem(item);
                created.setSupplier(defaultSupplier);
                created.setStatus(OrderStatus.NEEDS_ORDERING);
                return created;
            });

        entry.setQuantityNeeded(quantityNeeded);
        entry.setAdHoc(entry.getId() == null ? adHoc : entry.isAdHoc());
        if (note != null) {
            entry.setNote(note);
        }
        if (entry.getRaisedBy() == null) {
            entry.setRaisedBy(raisedBy);
        }
        orderListEntryRepository.save(entry);
    }
}
