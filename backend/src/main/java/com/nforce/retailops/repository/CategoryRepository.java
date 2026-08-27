package com.nforce.retailops.repository;

import com.nforce.retailops.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    List<Category> findByOwnerIdOrderByDisplayOrderAsc(Long ownerId);

    Optional<Category> findByIdAndOwnerId(Long id, Long ownerId);

    boolean existsByOwnerIdAndNameIgnoreCase(Long ownerId, String name);

    boolean existsByOwnerIdAndNameIgnoreCaseAndIdNot(Long ownerId, String name, Long id);

    int countByOwnerId(Long ownerId);
}
