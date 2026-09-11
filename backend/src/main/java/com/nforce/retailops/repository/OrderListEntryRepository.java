package com.nforce.retailops.repository;

import com.nforce.retailops.entity.OrderListEntry;
import com.nforce.retailops.entity.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrderListEntryRepository extends JpaRepository<OrderListEntry, Long> {

    List<OrderListEntry> findByStoreIdOrderByCreatedAtDesc(Long storeId);

    List<OrderListEntry> findByStoreIdAndStatusNotOrderByCreatedAtDesc(Long storeId, OrderStatus status);

    Optional<OrderListEntry> findByIdAndStoreId(Long id, Long storeId);

    // The "find" half of the find-or-create upsert for the active-entry-per-
    // item rule enforced at the DB level by the V49 partial unique index.
    Optional<OrderListEntry> findByStoreIdAndInventoryItemIdAndStatusNot(Long storeId, Long inventoryItemId, OrderStatus status);
}
