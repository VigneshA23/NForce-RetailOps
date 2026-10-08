package com.nforce.retailops.repository;

import com.nforce.retailops.entity.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {

    List<Supplier> findAllByOrderByNameAsc();

    List<Supplier> findByActiveTrueOrderByNameAsc();

    Optional<Supplier> findFirstByNameIgnoreCaseOrderByIdAsc(String name);

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
}
