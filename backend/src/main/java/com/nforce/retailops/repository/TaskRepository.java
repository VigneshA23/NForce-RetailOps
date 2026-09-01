package com.nforce.retailops.repository;

import com.nforce.retailops.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
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

    // Candidates for an employee's checklist at a given store and date: active tasks
    // (with an active category) belonging to the store's owner, scoped to the store
    // either via applies_to_all_stores or a specific task_stores entry, and within the
    // task's active date range. Day-of-week/schedule-type matching is done in the
    // service layer since it isn't a plain column comparison.
    @org.springframework.data.jpa.repository.Query(
        "select t from Task t where t.owner.id = :ownerId and t.active = true and t.category.active = true "
            + "and (t.appliesToAllStores = true or :storeId in (select s.id from t.stores s)) "
            + "and t.startDate <= :date and (t.endDate is null or t.endDate >= :date) "
            + "order by t.category.displayOrder asc, t.displayOrder asc, t.id asc"
    )
    List<Task> findActiveForStoreAndDate(
        @org.springframework.data.repository.query.Param("ownerId") Long ownerId,
        @org.springframework.data.repository.query.Param("storeId") Long storeId,
        @org.springframework.data.repository.query.Param("date") LocalDate date
    );
}
