package com.nforce.retailops.repository;

import com.nforce.retailops.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    Optional<Task> findByIdAndOwnerId(Long id, Long ownerId);

    long countByOwnerIdAndAppliesToAllStoresTrue(Long ownerId);

    @org.springframework.data.jpa.repository.Query(
        "select count(distinct t) from Task t join t.stores s where s.id = :storeId"
    )
    long countByStoreId(Long storeId);
}
