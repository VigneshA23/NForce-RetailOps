package com.nforce.retailops.repository;

import com.nforce.retailops.entity.InventoryUnit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InventoryUnitRepository extends JpaRepository<InventoryUnit, Long> {

    List<InventoryUnit> findAllByOrderByNameAsc();

    boolean existsByNameIgnoreCase(String name);
}
