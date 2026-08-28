package com.nforce.retailops.repository;

import com.nforce.retailops.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    Optional<Task> findByIdAndOwnerId(Long id, Long ownerId);

    long countByOwnerIdAndAppliesToAllStoresTrue(Long ownerId);

    @Query("select count(distinct t) from Task t join t.stores s where s.id = :storeId")
    long countByStoreId(Long storeId);

    /**
     * Tasks that are active, belong to the store's owner, are within their
     * date range, and either apply to all stores or are explicitly assigned
     * to this store. Day-of-week schedule eligibility (EVERY_DAY / WEEKDAYS /
     * WEEKENDS / SELECTED_DAYS) is evaluated in-memory by the caller since it
     * isn't practical to express cleanly in JPQL for this data volume.
     */
    @Query("""
        select distinct t from Task t
        left join t.stores s
        where t.owner.id = :ownerId
        and t.active = true
        and (t.appliesToAllStores = true or s.id = :storeId)
        and t.startDate <= :today
        and (t.endDate is null or t.endDate >= :today)
        order by t.category.displayOrder asc, t.name asc
        """)
    List<Task> findEligibleForEmployeeStore(
        @Param("ownerId") Long ownerId,
        @Param("storeId") Long storeId,
        @Param("today") LocalDate today
    );
}
