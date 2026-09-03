package com.nforce.retailops.repository;

import com.nforce.retailops.entity.Store;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StoreRepository extends JpaRepository<Store, Long> {

    // Single-round-trip form of listStores: rather than one query for the
    // owner's stores plus a separate batched count query per relation
    // (employee count, task count, applies-to-all count), pre-aggregate each
    // relation in its own subquery (so no join fan-out) and join them all
    // together in one native query. Columns, in order: id, store_code, name,
    // active, employee_count, store_task_count, applies_all_count.
    @Query(value = """
        SELECT s.id, s.store_code, s.name, s.active,
               COALESCE(ec.employee_count, 0) AS employee_count,
               COALESCE(tc.store_task_count, 0) AS store_task_count,
               COALESCE(ac.applies_all_count, 0) AS applies_all_count
        FROM stores s
        JOIN store_owners so ON so.store_id = s.id
        LEFT JOIN (
            SELECT store_id, COUNT(*) AS employee_count
            FROM employee_stores
            GROUP BY store_id
        ) ec ON ec.store_id = s.id
        LEFT JOIN (
            SELECT store_id, COUNT(DISTINCT task_id) AS store_task_count
            FROM task_stores
            GROUP BY store_id
        ) tc ON tc.store_id = s.id
        LEFT JOIN (
            SELECT COUNT(*) AS applies_all_count
            FROM tasks
            WHERE owner_id = :ownerId AND applies_to_all_stores = true
        ) ac ON true
        WHERE so.user_id = :ownerId
        ORDER BY s.id
        """, nativeQuery = true)
    List<Object[]> findOwnerStoreSummaryRows(@Param("ownerId") Long ownerId);
}
