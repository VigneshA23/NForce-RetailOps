package com.nforce.retailops.repository;

import com.nforce.retailops.entity.Category;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    // Used only by the pre-existing, untouched reorderCategories (Owner-Admin-
    // only, scoped to categories that owner personally created).
    List<Category> findByOwnerIdOrderByDisplayOrderAsc(Long ownerId);

    List<Category> findAllByOrderByNameAsc();

    List<Category> findByNameIgnoreCase(String name);

    List<Category> findByNameIgnoreCaseAndIdNot(String name, Long id);

    // Visible to an Owner Admin (read-only): they created it themselves
    // (regardless of its store assignment -- preserves every category an
    // owner already had before this feature existed), OR it has a store they
    // own, OR it's "all stores" and Super Admin created it (owner IS NULL).
    @Query("""
        select distinct c from Category c
        left join c.stores s
        where c.owner.id = :ownerId
           or s.id in (:storeIds)
           or (c.appliesToAllStores = true and c.owner is null)
        order by c.name asc
        """)
    List<Category> findVisibleToOwner(@Param("ownerId") Long ownerId, @Param("storeIds") List<Long> storeIds);

    // Single-category form of findVisibleToOwner -- used by TaskService to
    // validate that a category an owner is attaching a task to is one they can
    // actually see.
    @Query("""
        select distinct c from Category c
        left join c.stores s
        where c.id = :id
          and (c.owner.id = :ownerId
               or s.id in (:storeIds)
               or (c.appliesToAllStores = true and c.owner is null))
        """)
    Optional<Category> findVisibleToOwnerById(
        @Param("id") Long id, @Param("ownerId") Long ownerId, @Param("storeIds") List<Long> storeIds);

    // Batched form for listing many categories at once without one query per
    // category -- mirrors TaskRepository.findStoreRowsGroupedByTaskIds.
    @Query("select c.id, s.id, s.name from Category c join c.stores s where c.id in :categoryIds order by s.name asc")
    List<Object[]> findStoreRowsGroupedByCategoryIds(@Param("categoryIds") Collection<Long> categoryIds);

    // Owner Admin quick-search (AdminSearchService) -- searches only categories
    // that owner personally created, unrelated to store-based visibility.
    @Query("select c from Category c where c.owner.id = :ownerId "
        + "and lower(c.name) like lower(concat('%', :q, '%')) order by c.name")
    List<Category> searchByOwnerIdAndName(@Param("ownerId") Long ownerId, @Param("q") String q, Pageable pageable);
}
