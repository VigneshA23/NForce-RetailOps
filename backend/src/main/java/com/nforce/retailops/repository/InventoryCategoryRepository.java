package com.nforce.retailops.repository;

import com.nforce.retailops.entity.InventoryCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InventoryCategoryRepository extends JpaRepository<InventoryCategory, Long> {

    List<InventoryCategory> findAllByOrderByDisplayOrderAsc();
}
