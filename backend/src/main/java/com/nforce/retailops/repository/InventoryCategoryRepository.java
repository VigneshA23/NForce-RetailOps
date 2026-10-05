package com.nforce.retailops.repository;

import com.nforce.retailops.entity.InventoryCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InventoryCategoryRepository extends JpaRepository<InventoryCategory, Long> {

    List<InventoryCategory> findAllByOrderByNameAsc();

    List<InventoryCategory> findByActiveTrueOrderByNameAsc();

    Optional<InventoryCategory> findFirstByNameIgnoreCaseOrderByIdAsc(String name);
}
