package com.nforce.retailops.repository;

import com.nforce.retailops.entity.StoreEmployee;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StoreEmployeeRepository extends JpaRepository<StoreEmployee, Long> {

    // Y in the "X/Y Completed By" checklist status, and every store headcount shown
    // elsewhere (Store Management, Super Admin Stores): only employees whose User
    // account is still active count -- a raw employee_stores row count would keep
    // counting an employee after they're deactivated (deactivation never removes the
    // row, only flips User.active).
    int countByStoresIdAndEmployeeActiveTrue(Long storeId);

    // Platform-wide active headcount for Super Admin's "Employees active today" /
    // total-employees denominator -- a plain count, not scoped to any one store's
    // employee_stores rows (one StoreEmployee row already represents one employee,
    // regardless of how many stores they're assigned to).
    long countByEmployeeActiveTrue();

    // Batched form of countByStoresIdAndEmployeeActiveTrue, for the Store Management /
    // Super Admin Stores list "Total Employees" tile and per-store column -- must match
    // what the Employees page actually shows (active headcount), not a raw employee_stores
    // join-table row count, which keeps counting an employee after they're deactivated
    // (deactivation never removes the row, only flips User.active).
    @Query("select s.id, count(se) from StoreEmployee se join se.stores s "
        + "where s.id in :storeIds and se.employee.active = true group by s.id")
    List<Object[]> countActiveGroupedByStoreIds(@Param("storeIds") Collection<Long> storeIds);

    List<StoreEmployee> findDistinctByStoresIdInOrderByIdAsc(Collection<Long> storeIds);

    List<StoreEmployee> findByCreatedByOwnerId(Long ownerId);

    // Fetch-joined forms of the two finders above, for listEmployees: the User
    // side of the one-to-one is required by every row of the response, so
    // fetch it up front instead of one lazy-load query per employee.
    @Query("select distinct se from StoreEmployee se join fetch se.employee join se.stores s where s.id in :storeIds order by se.id asc")
    List<StoreEmployee> findDistinctByStoresIdInOrderByIdAscFetchEmployee(@Param("storeIds") Collection<Long> storeIds);

    @Query("select se from StoreEmployee se join fetch se.employee where se.createdByOwner.id = :ownerId")
    List<StoreEmployee> findByCreatedByOwnerIdFetchEmployee(@Param("ownerId") Long ownerId);

    // Super Admin's cross-owner employee directory: every employee platform-wide,
    // with its User and creating owner fetched up front (left join -- a legacy row
    // could in principle have no recorded creator) to avoid a lazy-load per row.
    @Query("select se from StoreEmployee se join fetch se.employee left join fetch se.createdByOwner")
    List<StoreEmployee> findAllFetchEmployeeAndCreatedByOwner();

    // Batched form of StoreEmployee.stores, for listing many employees at once
    // without one query per employee for their (lazy, many-to-many) store list.
    @Query("select se.id, s.id, s.name from StoreEmployee se join se.stores s where se.id in :employeeIds order by s.name asc")
    List<Object[]> findStoreRowsGroupedByEmployeeIds(@Param("employeeIds") Collection<Long> employeeIds);

    // Keyed on the User id, which is what the authenticated principal yields --
    // not the StoreEmployee PK.
    Optional<StoreEmployee> findByEmployeeId(Long userId);

    // Batched form of findByEmployeeId, for enriching many distinct responders at once
    // (e.g. admin checklist history) without one query per employee.
    List<StoreEmployee> findByEmployeeIdIn(Collection<Long> userIds);

    boolean existsByEmployeeIdAndStoresId(Long userId, Long storeId);

    @Query("select se from StoreEmployee se join fetch se.employee u "
        + "where lower(u.fullName) like lower(concat('%', :q, '%')) or lower(u.email) like lower(concat('%', :q, '%')) "
        + "order by u.fullName")
    List<StoreEmployee> searchByNameOrEmail(@Param("q") String q, Pageable pageable);

    @Query("select se from StoreEmployee se join fetch se.employee u join se.stores s "
        + "where s.id = :storeId "
        + "and (lower(u.fullName) like lower(concat('%', :q, '%')) or lower(u.email) like lower(concat('%', :q, '%'))) "
        + "order by u.fullName")
    List<StoreEmployee> searchByNameOrEmailAndStoreId(@Param("storeId") Long storeId, @Param("q") String q, Pageable pageable);
}
