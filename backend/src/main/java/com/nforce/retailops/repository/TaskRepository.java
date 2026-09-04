package com.nforce.retailops.repository;

import com.nforce.retailops.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
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

    // Fetch-joined form of the above, for listTasks: every row of the response
    // needs its category's name, so fetch it up front instead of one lazy-load
    // query per task.
    @org.springframework.data.jpa.repository.Query(
        "select t from Task t join fetch t.category where t.owner.id = :ownerId "
            + "order by t.category.displayOrder asc, t.displayOrder asc, t.updatedAt desc, t.id asc"
    )
    List<Task> findByOwnerIdOrderByCategoryAndDisplayOrderFetchCategory(
        @org.springframework.data.repository.query.Param("ownerId") Long ownerId
    );

    // Batched form of Task.stores, for listing many tasks at once without one
    // query per task for its (lazy, many-to-many) store list.
    @org.springframework.data.jpa.repository.Query(
        "select t.id, s.id, s.name from Task t join t.stores s where t.id in :taskIds order by s.name asc"
    )
    List<Object[]> findStoreRowsGroupedByTaskIds(
        @org.springframework.data.repository.query.Param("taskIds") Collection<Long> taskIds
    );

    Optional<Task> findByIdAndOwnerId(Long id, Long ownerId);

    long countByOwnerIdAndAppliesToAllStoresTrue(Long ownerId);

    int countByCategoryId(Long categoryId);

    // For cascading a category's active/inactive toggle onto every task under it.
    List<Task> findByCategoryId(Long categoryId);

    @org.springframework.data.jpa.repository.Query(
        "select count(distinct t) from Task t join t.stores s where s.id = :storeId"
    )
    long countByStoreId(Long storeId);

    // Batched form of countByCategoryId, for listing many categories at once
    // without one count query per category.
    @org.springframework.data.jpa.repository.Query(
        "select t.category.id, count(t) from Task t where t.category.id in :categoryIds group by t.category.id"
    )
    List<Object[]> countGroupedByCategoryIds(
        @org.springframework.data.repository.query.Param("categoryIds") Collection<Long> categoryIds
    );

    // Batched form of countByStoreId, for listing many stores at once without
    // one count query per store.
    @org.springframework.data.jpa.repository.Query(
        "select s.id, count(distinct t) from Task t join t.stores s where s.id in :storeIds group by s.id"
    )
    List<Object[]> countGroupedByStoreIds(
        @org.springframework.data.repository.query.Param("storeIds") Collection<Long> storeIds
    );

    // Batched form of countByOwnerIdAndAppliesToAllStoresTrue, for the Super
    // Admin's cross-owner store directory (one query for every owner's
    // applies-to-all-stores count instead of one query per owner).
    @org.springframework.data.jpa.repository.Query(
        "select t.owner.id, count(t) from Task t where t.owner.id in :ownerIds and t.appliesToAllStores = true group by t.owner.id"
    )
    List<Object[]> countAppliesToAllGroupedByOwnerIds(
        @org.springframework.data.repository.query.Param("ownerIds") Collection<Long> ownerIds
    );

    // Candidates for an employee's checklist at a given store and date: active tasks
    // (with an active category) belonging to the store's owner, scoped to the store
    // either via applies_to_all_stores or a specific task_stores entry, and within the
    // task's active date range. Day-of-week/schedule-type matching is done in the
    // service layer since it isn't a plain column comparison.
    // join fetch t.category: every caller (today's checklist, both history detail
    // services) reads task.getCategory().getName()/getDisplayOrder() while building
    // its response, so fetch it up front instead of one lazy-load query per
    // distinct category.
    @org.springframework.data.jpa.repository.Query(
        "select t from Task t join fetch t.category where t.owner.id = :ownerId and t.active = true and t.category.active = true "
            + "and (t.appliesToAllStores = true or :storeId in (select s.id from t.stores s)) "
            + "and t.startDate <= :date and (t.endDate is null or t.endDate >= :date) "
            + "order by t.category.displayOrder asc, t.displayOrder asc, t.id asc"
    )
    List<Task> findActiveForStoreAndDate(
        @org.springframework.data.repository.query.Param("ownerId") Long ownerId,
        @org.springframework.data.repository.query.Param("storeId") Long storeId,
        @org.springframework.data.repository.query.Param("date") LocalDate date
    );

    // Batched, multi-store range-overlap variant of findActiveForStoreAndDate, for the
    // admin checklist-history summary view: fetches the superset of tasks that could
    // apply on ANY day in [startDate, endDate] across ALL requested stores in one query
    // (instead of one query per store), so per-store/per-day eligibility (which still
    // depends on each task's own startDate/endDate, store scoping and schedule type)
    // can be evaluated in memory without re-querying the DB once per store.
    @org.springframework.data.jpa.repository.Query(
        "select t from Task t where t.owner.id = :ownerId and t.active = true and t.category.active = true "
            + "and (t.appliesToAllStores = true or exists (select s.id from t.stores s where s.id in :storeIds)) "
            + "and t.startDate <= :endDate and (t.endDate is null or t.endDate >= :startDate) "
            + "order by t.category.displayOrder asc, t.displayOrder asc, t.id asc"
    )
    List<Task> findActiveForStoresAndDateRange(
        @org.springframework.data.repository.query.Param("ownerId") Long ownerId,
        @org.springframework.data.repository.query.Param("storeIds") Collection<Long> storeIds,
        @org.springframework.data.repository.query.Param("startDate") LocalDate startDate,
        @org.springframework.data.repository.query.Param("endDate") LocalDate endDate
    );
}
