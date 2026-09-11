package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreInventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StoreInventoryItemRepository extends JpaRepository<StoreInventoryItem, Long> {

    List<StoreInventoryItem> findByStoreIdOrderById(Long storeId);

    List<StoreInventoryItem> findByStoreIdAndActiveTrueOrderById(Long storeId);

    Optional<StoreInventoryItem> findByIdAndStoreId(Long id, Long storeId);

    boolean existsByStoreIdAndInventoryItemId(Long storeId, Long inventoryItemId);
}
