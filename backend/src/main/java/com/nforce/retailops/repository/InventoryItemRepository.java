package com.nforce.retailops.repository;

import com.nforce.retailops.entity.InventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {

    List<InventoryItem> findAllByOrderByNameAsc();

    List<InventoryItem> findByActiveTrueOrderByNameAsc();

    int countByCategoryId(Long categoryId);
}
