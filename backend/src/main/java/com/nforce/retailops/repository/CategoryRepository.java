package com.nforce.retailops.repository;

import com.nforce.retailops.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    List<Category> findByOwnerIdOrderByDisplayOrderAsc(Long ownerId);

    // Single-round-trip form of listCategories: pre-aggregates the task count
    // in its own subquery (so no join fan-out) rather than a separate batched
    // count query after fetching the categories. Columns, in order: id, name,
    // display_order, active, task_count.
    @Query(value = """
        SELECT c.id, c.name, c.display_order, c.active,
               COALESCE(tc.task_count, 0) AS task_count
        FROM categories c
        LEFT JOIN (
            SELECT category_id, COUNT(*) AS task_count
            FROM tasks
            GROUP BY category_id
        ) tc ON tc.category_id = c.id
        WHERE c.owner_id = :ownerId
        ORDER BY c.display_order ASC
        """, nativeQuery = true)
    List<Object[]> findOwnerCategorySummaryRows(@Param("ownerId") Long ownerId);

    Optional<Category> findByIdAndOwnerId(Long id, Long ownerId);

    boolean existsByOwnerIdAndNameIgnoreCase(Long ownerId, String name);

    boolean existsByOwnerIdAndNameIgnoreCaseAndIdNot(Long ownerId, String name, Long id);

    int countByOwnerId(Long ownerId);
}
