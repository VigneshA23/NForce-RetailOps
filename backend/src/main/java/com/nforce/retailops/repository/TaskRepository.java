package com.nforce.retailops.repository;

import com.nforce.retailops.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {

    // Task Management list order: by category (in the category's own configured order),
    // then by each task's display order within that category. Ties (including a task
    // just edited into the same order as another) are broken deterministically by most
    // recently updated first, then id, so the list never shuffles randomly between loads.
    @org.springframework.data.jpa.repository.Query(
        "select t from Task t where t.owner.id = :ownerId "
            + "order by t.category.displayOrder asc, t.displayOrder asc, t.updatedAt desc, t.id asc"
    )
    List<Task> findByOwnerIdOrderByCategoryAndDisplayOrder(
        @org.springframework.data.repository.query.Param("ownerId") Long ownerId
    );

    Optional<Task> findByIdAndOwnerId(Long id, Long ownerId);

    long countByOwnerIdAndAppliesToAllStoresTrue(Long ownerId);

    int countByCategoryId(Long categoryId);

    @org.springframework.data.jpa.repository.Query(
        "select count(distinct t) from Task t join t.stores s where s.id = :storeId"
    )
    long countByStoreId(Long storeId);

    // Employee checklist: only active tasks belonging to the store's owner and applicable
    // to this specific store (either explicitly assigned or "all stores"), grouped in the
    // same category/display order as Task Management.
    @org.springframework.data.jpa.repository.Query(
        "select t from Task t where t.owner.id = :ownerId and t.active = true "
            + "and (t.appliesToAllStores = true or :storeId in (select s.id from t.stores s)) "
            + "order by t.category.displayOrder asc, t.displayOrder asc, t.id asc"
    )
    List<Task> findActiveForOwnerApplicableToStore(
        @org.springframework.data.repository.query.Param("ownerId") Long ownerId,
        @org.springframework.data.repository.query.Param("storeId") Long storeId
    );
}
